import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../db/client.js";
import {
  customers,
  orderItems,
  orders,
  products,
  users,
  type OrderStatus,
} from "../db/schema.js";
import { protectedProcedure } from "../trpc.js";
import { releaseStock, reserveStock } from "./catalog.js";
import { requireCustomer, type Customer } from "./customers.js";
import { issueInvoice } from "./invoices.js";

/**
 * Orders and their lifecycle. This module owns the `orders` and `order_items`
 * tables and drives the transactions that place, ship and cancel an order.
 *
 * The rules it keeps, in one place:
 *  - Line prices are frozen when the order is placed; later price changes in
 *    the catalog do not move an existing order's total.
 *  - An order's total is always the sum of its lines, to two decimals.
 *  - Placing an order takes the goods off stock (catalog), all lines or none.
 *  - Only an *open* order can be shipped or cancelled, and only once:
 *    shipping issues its invoice, cancelling puts the goods back on stock.
 */

export { ORDER_STATUSES } from "../db/schema.js";
export type { OrderStatus } from "../db/schema.js";

/** An order as it is stored. */
export type Order = {
  id: number;
  customerId: number;
  status: OrderStatus;
  /** Null for orders from before everyone signed in. */
  createdById: number | null;
  createdAt: Date;
};

/** An order line as it is stored. */
export type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  /** Price per unit when the order was placed, as a numeric string. */
  unitPrice: string;
};

/** An order line as the application shows it, with the product's name. */
export type OrderLine = {
  productId: number;
  quantity: number;
  unitPrice: string;
  productName: string;
};

type OrderCommon = {
  id: number;
  /** ISO timestamp. */
  createdAt: string;
  status: OrderStatus;
  /** Name of the team member who recorded it; null for old entries. */
  recordedBy: string | null;
  /** Sum of the lines, to two decimals. */
  total: string;
};

/** An order in the all-orders list, with the customer it belongs to. */
export type OrderSummary = OrderCommon & {
  customerId: number;
  contactName: string;
  company: string;
  items: OrderLine[];
};

/** Everything about a single order: status, customer, and all line items. */
export type OrderDetail = OrderCommon & {
  customer: Pick<
    Customer,
    "id" | "contactName" | "company" | "address" | "email" | "customerSince"
  >;
  items: OrderLine[];
};

/**
 * An order in a customer's own order history. The customer is already known
 * there, and so is each line's product, so neither is repeated.
 */
export type CustomerOrder = OrderCommon & {
  items: Omit<OrderLine, "productId">[];
};

const orderInput = z.object({
  customerId: z.number().int().positive("Please choose a customer"),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive("Please choose a product"),
        quantity: z
          .number()
          .int("Quantity must be a whole number")
          .min(1, "Quantity must be at least 1"),
      }),
    )
    .min(1, "An order needs at least one product")
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      "Each product may only appear once per order",
    ),
});

const orderId = z.object({ id: z.number().int().positive() });

/** How many orders the all-orders list shows per page. */
const ORDERS_PAGE_SIZE = 20;

const orderListInput = z
  .object({ page: z.number().int().min(1).default(1) })
  .optional();

/** The one place an order total is worked out. */
function totalOf(
  items: readonly { unitPrice: string; quantity: number }[],
): string {
  return items
    .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
    .toFixed(2);
}

/**
 * Move an order out of "open" into `next`.
 *
 * The status guard makes the update a no-op unless the order is still open, so
 * a concurrent ship/cancel can never take effect twice — which is what keeps
 * an order from being restocked or invoiced more than once. Fails with
 * NOT_FOUND when there is no such order, and with CONFLICT and the reason
 * from `refuse` when it is no longer open.
 */
async function leaveOpen(
  tx: Tx,
  id: number,
  next: OrderStatus,
  refuse: (current: OrderStatus) => string,
): Promise<{ id: number; status: OrderStatus }> {
  const [updated] = await tx
    .update(orders)
    .set({ status: next })
    .where(and(eq(orders.id, id), eq(orders.status, "open")))
    .returning();
  if (updated) return { id: updated.id, status: updated.status };

  const [existing] = await tx
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, id));
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
  }
  throw new TRPCError({ code: "CONFLICT", message: refuse(existing.status) });
}

/** The stored lines of one order, in the order they were entered. */
async function linesOf(tx: Tx, id: number) {
  return tx
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, id));
}

export const orderProcedures = {
  /**
   * A page of orders, newest first, with each order's customer, contents
   * and total, plus how many orders there are in all.
   */
  list: protectedProcedure
    .input(orderListInput)
    .query(async ({ input }): Promise<{ orders: OrderSummary[]; total: number }> => {
      const page = input?.page ?? 1;

      const [orderRows, [{ count: total }]] = await Promise.all([
        db
          .select({
            id: orders.id,
            createdAt: orders.createdAt,
            status: orders.status,
            customerId: orders.customerId,
            contactName: customers.contactName,
            company: customers.company,
            // Who recorded the order; null for old entries.
            recordedBy: users.name,
          })
          .from(orders)
          .innerJoin(customers, eq(customers.id, orders.customerId))
          .leftJoin(users, eq(users.id, orders.createdById))
          .orderBy(desc(orders.createdAt), desc(orders.id))
          .limit(ORDERS_PAGE_SIZE)
          .offset((page - 1) * ORDERS_PAGE_SIZE),
        db.select({ count: sql<number>`count(*)::int` }).from(orders),
      ]);

      const itemRows = orderRows.length
        ? await db
            .select({
              orderId: orderItems.orderId,
              productId: orderItems.productId,
              quantity: orderItems.quantity,
              unitPrice: orderItems.unitPrice,
              productName: products.name,
            })
            .from(orderItems)
            .innerJoin(products, eq(products.id, orderItems.productId))
            .where(
              inArray(
                orderItems.orderId,
                orderRows.map((order) => order.id),
              ),
            )
            .orderBy(orderItems.id)
        : [];

      const ordersOut = orderRows.map((order) => {
        const items = itemRows
          .filter((item) => item.orderId === order.id)
          .map(({ orderId: _orderId, ...item }) => item);
        return {
          ...order,
          createdAt: order.createdAt.toISOString(),
          items,
          total: totalOf(items),
        };
      });

      return { orders: ordersOut, total };
    }),

  /** Fails with NOT_FOUND when there is no such order. */
  byId: protectedProcedure
    .input(orderId)
    .query(async ({ input }): Promise<OrderDetail> => {
      const [order] = await db
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          status: orders.status,
          // Who recorded the order; null for old entries.
          recordedBy: users.name,
          customer: {
            id: customers.id,
            contactName: customers.contactName,
            company: customers.company,
            address: customers.address,
            email: customers.email,
            customerSince: customers.customerSince,
          },
        })
        .from(orders)
        .innerJoin(customers, eq(customers.id, orders.customerId))
        .leftJoin(users, eq(users.id, orders.createdById))
        .where(eq(orders.id, input.id));
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const items = await db
        .select({
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          productName: products.name,
        })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .where(eq(orderItems.orderId, input.id))
        .orderBy(orderItems.id);

      return {
        ...order,
        createdAt: order.createdAt.toISOString(),
        items,
        total: totalOf(items),
      };
    }),

  /**
   * Place an order for a customer. Goes through as a whole or not at all: the
   * goods are taken off stock and the line prices frozen in the same
   * transaction that writes the order.
   *
   * Fails with NOT_FOUND (unknown customer), BAD_REQUEST (unknown product or
   * not enough stock, all shortages in one message) or CONFLICT (stock changed
   * underneath) — see `catalog.reserveStock`.
   */
  create: protectedProcedure.input(orderInput).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      await requireCustomer(tx, input.customerId);
      const unitPrices = await reserveStock(tx, input.items);

      // Remember who recorded the order; `created_at` says when.
      const [order] = await tx
        .insert(orders)
        .values({ customerId: input.customerId, createdById: ctx.user.id })
        .returning();
      await tx.insert(orderItems).values(
        input.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPrices.get(item.productId)!,
        })),
      );
      return {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      };
    });
  }),

  /**
   * Cancel an order that has not been shipped yet (e.g. the customer
   * called and cancelled). The ordered quantities go back on stock.
   * Only open orders can be cancelled: once shipped, the goods have
   * left the warehouse and a plain cancellation no longer applies.
   */
  cancel: protectedProcedure.input(orderId).mutation(async ({ input }) => {
    return db.transaction(async (tx) => {
      const cancelled = await leaveOpen(tx, input.id, "cancelled", (current) =>
        current === "cancelled"
          ? `Order #${input.id} is already cancelled.`
          : `Order #${input.id} has already been ${current} and can no longer be cancelled.`,
      );
      await releaseStock(tx, await linesOf(tx, input.id));
      return cancelled;
    });
  }),

  /**
   * Mark an order as sent out, which also issues its invoice over the order
   * total as it stands now. Only open orders can be shipped, so an order can
   * never end up with two invoices.
   */
  markShipped: protectedProcedure.input(orderId).mutation(async ({ input }) => {
    return db.transaction(async (tx) => {
      const shipped = await leaveOpen(tx, input.id, "shipped", (current) =>
        current === "shipped"
          ? `Order #${input.id} is already marked as shipped.`
          : `Order #${input.id} is ${current} and can no longer be shipped.`,
      );
      const invoice = await issueInvoice(
        tx,
        input.id,
        totalOf(await linesOf(tx, input.id)),
      );
      return {
        ...shipped,
        invoiceId: invoice.id,
        invoiceAmount: invoice.amount,
      };
    });
  }),
};

/**
 * All orders a customer has placed, newest first, each with its
 * current status (open / shipped / cancelled) and line items.
 * Mounted under `customer.orders`; fails with NOT_FOUND for an unknown
 * customer, and returns an empty list for a customer without orders.
 */
export const customerOrdersProcedure = protectedProcedure
  .input(z.object({ customerId: z.number().int().positive() }))
  .query(async ({ input }): Promise<CustomerOrder[]> => {
    await requireCustomer(db, input.customerId);

    const orderRows = await db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        status: orders.status,
        // Who recorded the order; null for old entries.
        recordedBy: users.name,
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.createdById))
      .where(eq(orders.customerId, input.customerId))
      .orderBy(desc(orders.createdAt), desc(orders.id));
    if (orderRows.length === 0) return [];

    const itemRows = await db
      .select({
        orderId: orderItems.orderId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        productName: products.name,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orders.customerId, input.customerId))
      .orderBy(orderItems.id);

    return orderRows.map((order) => {
      const items = itemRows
        .filter((item) => item.orderId === order.id)
        .map(({ orderId: _orderId, ...item }) => item);
      return {
        ...order,
        createdAt: order.createdAt.toISOString(),
        items,
        total: totalOf(items),
      };
    });
  });
