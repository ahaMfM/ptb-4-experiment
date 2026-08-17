import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Transaction } from "../db/index.js";
import {
  customers,
  invoices,
  orderItems,
  orders,
  products,
  users,
  type OrderStatus,
} from "../db/schema.js";
import { orNotFound } from "../errors.js";
import { lineItemsTotal, orderLines } from "../line-items.js";
import { protectedProcedure, router } from "../trpc.js";

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

/**
 * Move an order out of "open" — the only status from which shipping and
 * cancelling are allowed. The status guard makes the update a no-op unless
 * the order is still open, so two concurrent transitions can never both
 * take effect; the loser is told why with `explainConflict`.
 */
async function transitionFromOpen(
  tx: Transaction,
  orderId: number,
  nextStatus: OrderStatus,
  explainConflict: (currentStatus: OrderStatus) => string,
): Promise<{ id: number; status: OrderStatus }> {
  const [updated] = await tx
    .update(orders)
    .set({ status: nextStatus })
    .where(and(eq(orders.id, orderId), eq(orders.status, "open")))
    .returning();
  if (updated) return { id: updated.id, status: updated.status };

  const [existing] = await tx
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId));
  const { status } = orNotFound(existing, "Order not found");
  throw new TRPCError({ code: "CONFLICT", message: explainConflict(status) });
}

export const orderRouter = router({
  list: protectedProcedure.query(async () => {
    const orderRows = await db
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
      .orderBy(desc(orders.createdAt), desc(orders.id));

    const itemRows = await db
      .select({
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        productName: products.name,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .orderBy(orderItems.id);

    return orderRows.map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      customerId: order.customerId,
      contactName: order.contactName,
      company: order.company,
      recordedBy: order.recordedBy,
      ...orderLines(itemRows, order.id),
    }));
  }),
  /** Everything about a single order: status, customer, and all line items. */
  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [row] = await db
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
      const order = orNotFound(row, "Order not found");

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
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        recordedBy: order.recordedBy,
        customer: order.customer,
        items,
        total: lineItemsTotal(items),
      };
    }),
  create: protectedProcedure
    .input(orderInput)
    .mutation(async ({ input, ctx }) => {
      return db.transaction(async (tx) => {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, input.customerId));
        orNotFound(customer, "Customer not found");

        const productRows = await tx
          .select()
          .from(products)
          .where(
            inArray(
              products.id,
              input.items.map((item) => item.productId),
            ),
          );
        const productById = new Map(productRows.map((p) => [p.id, p]));

        // Check stock for every line first so the user is told about
        // all shortages at once, and the order goes through as a whole or
        // not at all.
        const problems: string[] = [];
        for (const item of input.items) {
          const product = productById.get(item.productId);
          if (!product) {
            problems.push(`Product #${item.productId} no longer exists.`);
          } else if (product.stock < item.quantity) {
            problems.push(
              `Not enough stock for “${product.name}”: ${item.quantity} requested, ${product.stock} available.`,
            );
          }
        }
        if (problems.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: problems.join(" "),
          });
        }

        // Decrement stock with a guard so a concurrent order can never
        // push stock below zero; if the guard fails, roll everything back.
        for (const item of input.items) {
          const updated = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${item.quantity}` })
            .where(
              and(
                eq(products.id, item.productId),
                gte(products.stock, item.quantity),
              ),
            )
            .returning({ id: products.id });
          if (updated.length === 0) {
            const name =
              productById.get(item.productId)?.name ?? `#${item.productId}`;
            throw new TRPCError({
              code: "CONFLICT",
              message: `Stock of “${name}” changed while placing the order. Please try again.`,
            });
          }
        }

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
            unitPrice: productById.get(item.productId)!.price,
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
  cancel: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        const cancelled = await transitionFromOpen(
          tx,
          input.id,
          "cancelled",
          (status) =>
            status === "cancelled"
              ? `Order #${input.id} is already cancelled.`
              : `Order #${input.id} has already been ${status} and can no longer be cancelled.`,
        );

        // Return every ordered quantity to stock.
        const items = await tx
          .select({
            productId: orderItems.productId,
            quantity: orderItems.quantity,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, input.id));
        for (const item of items) {
          await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${item.quantity}` })
            .where(eq(products.id, item.productId));
        }

        return cancelled;
      });
    }),
  /**
   * Mark an order as sent out. Only open orders can be shipped, so the
   * status filter doubles as a guard against double-shipping. Shipping
   * also issues the invoice for the order, with the amount taken from
   * the order's line items.
   */
  markShipped: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        const shipped = await transitionFromOpen(
          tx,
          input.id,
          "shipped",
          (status) =>
            status === "shipped"
              ? `Order #${input.id} is already marked as shipped.`
              : `Order #${input.id} is ${status} and can no longer be shipped.`,
        );

        // Issue the invoice: the amount is the order total, frozen now.
        const items = await tx
          .select({
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, input.id));
        const [invoice] = await tx
          .insert(invoices)
          .values({ orderId: input.id, amount: lineItemsTotal(items) })
          .returning();

        return {
          ...shipped,
          invoiceId: invoice.id,
          invoiceAmount: invoice.amount,
        };
      });
    }),
});
