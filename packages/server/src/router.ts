import { initTRPC, TRPCError } from "@trpc/server";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/index.js";
import { customers, orderItems, orders, products } from "./db/schema.js";

export type { Customer, Order, OrderItem, OrderStatus, Product } from "./db/schema.js";
export { ORDER_STATUSES } from "./db/schema.js";

const t = initTRPC.create();

/** Roughly 2 MB of binary data once base64-encoded, plus data-URL header. */
const MAX_IMAGE_DATA_URL_LENGTH = 2_900_000;

const productInput = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().trim().min(1, "Description is required"),
  image: z
    .string()
    .regex(
      /^data:image\/(png|jpeg|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/,
      "A product picture is required",
    )
    .max(MAX_IMAGE_DATA_URL_LENGTH, "Picture must be 2 MB or smaller"),
  price: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Price must be a positive amount like 19.90"),
  stock: z
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative"),
});

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
 * Drizzle wraps driver errors ("Failed query: …") with the real Postgres
 * error in `cause`, so walk the cause chain when looking for FK violations.
 */
function isForeignKeyViolation(err: unknown): boolean {
  while (err instanceof Error) {
    if (/foreign key/i.test(err.message)) return true;
    err = err.cause;
  }
  return false;
}

const customerInput = z.object({
  contactName: z.string().trim().min(1, "Contact name is required"),
  company: z.string().trim().min(1, "Company is required"),
  address: z.string().trim().min(1, "Address is required"),
  email: z.email("A valid e-mail address is required"),
  customerSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export const appRouter = t.router({
  customer: t.router({
    list: t.procedure
      .input(z.object({ search: z.string().trim().optional() }).optional())
      .query(({ input }) => {
        const term = input?.search;
        // Escape LIKE wildcards so a search for "100%" matches literally.
        const pattern = term
          ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
          : null;
        return db
          .select()
          .from(customers)
          .where(
            pattern
              ? or(
                  ilike(customers.contactName, pattern),
                  ilike(customers.company, pattern),
                )
              : undefined,
          )
          .orderBy(desc(customers.customerSince), desc(customers.id));
      }),
    create: t.procedure.input(customerInput).mutation(async ({ input }) => {
      const [created] = await db.insert(customers).values(input).returning();
      return created;
    }),
    update: t.procedure
      .input(customerInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const { id, ...values } = input;
        const [updated] = await db
          .update(customers)
          .set(values)
          .where(eq(customers.id, id))
          .returning();
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Customer not found",
          });
        }
        return updated;
      }),
    remove: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        let deleted;
        try {
          [deleted] = await db
            .delete(customers)
            .where(eq(customers.id, input.id))
            .returning();
        } catch (err) {
          if (isForeignKeyViolation(err)) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This customer has orders on record and cannot be deleted.",
            });
          }
          throw err;
        }
        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Customer not found",
          });
        }
        return deleted;
      }),
  }),
  product: t.router({
    /** Public catalog: everyone can see the products on offer and their stock. */
    list: t.procedure.query(() => {
      return db.select().from(products).orderBy(products.name, products.id);
    }),
    create: t.procedure.input(productInput).mutation(async ({ input }) => {
      const [created] = await db.insert(products).values(input).returning();
      return created;
    }),
    update: t.procedure
      .input(productInput.extend({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const { id, ...values } = input;
        const [updated] = await db
          .update(products)
          .set(values)
          .where(eq(products.id, id))
          .returning();
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found",
          });
        }
        return updated;
      }),
    remove: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        let deleted;
        try {
          [deleted] = await db
            .delete(products)
            .where(eq(products.id, input.id))
            .returning();
        } catch (err) {
          if (isForeignKeyViolation(err)) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This product appears in existing orders and cannot be deleted.",
            });
          }
          throw err;
        }
        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found",
          });
        }
        return deleted;
      }),
  }),
  order: t.router({
    list: t.procedure.query(async () => {
      const orderRows = await db
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          status: orders.status,
          customerId: orders.customerId,
          contactName: customers.contactName,
          company: customers.company,
        })
        .from(orders)
        .innerJoin(customers, eq(customers.id, orders.customerId))
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

      return orderRows.map((order) => {
        const items = itemRows
          .filter((item) => item.orderId === order.id)
          .map(({ orderId: _orderId, ...item }) => item);
        const total = items.reduce(
          (sum, item) => sum + Number(item.unitPrice) * item.quantity,
          0,
        );
        return {
          id: order.id,
          createdAt: order.createdAt.toISOString(),
          status: order.status,
          customerId: order.customerId,
          contactName: order.contactName,
          company: order.company,
          items,
          total: total.toFixed(2),
        };
      });
    }),
    /** Everything about a single order: status, customer, and all line items. */
    byId: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const [order] = await db
          .select({
            id: orders.id,
            createdAt: orders.createdAt,
            status: orders.status,
            customer: customers,
          })
          .from(orders)
          .innerJoin(customers, eq(customers.id, orders.customerId))
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

        const total = items.reduce(
          (sum, item) => sum + Number(item.unitPrice) * item.quantity,
          0,
        );

        return {
          id: order.id,
          createdAt: order.createdAt.toISOString(),
          status: order.status,
          customer: order.customer,
          items,
          total: total.toFixed(2),
        };
      }),
    create: t.procedure.input(orderInput).mutation(async ({ input }) => {
      return db.transaction(async (tx) => {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, input.customerId));
        if (!customer) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Customer not found",
          });
        }

        const productIds = input.items.map((i) => i.productId);
        const productRows = await tx
          .select()
          .from(products)
          .where(inArray(products.id, productIds));
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
            const name = productById.get(item.productId)?.name ?? `#${item.productId}`;
            throw new TRPCError({
              code: "CONFLICT",
              message: `Stock of “${name}” changed while placing the order. Please try again.`,
            });
          }
        }

        const [order] = await tx
          .insert(orders)
          .values({ customerId: input.customerId })
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
     * Mark an order as sent out. Only open orders can be shipped, so the
     * status filter doubles as a guard against double-shipping.
     */
    markShipped: t.procedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const [updated] = await db
          .update(orders)
          .set({ status: "shipped" })
          .where(and(eq(orders.id, input.id), eq(orders.status, "open")))
          .returning();
        if (!updated) {
          const [existing] = await db
            .select({ status: orders.status })
            .from(orders)
            .where(eq(orders.id, input.id));
          if (!existing) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Order not found",
            });
          }
          throw new TRPCError({
            code: "CONFLICT",
            message:
              existing.status === "shipped"
                ? `Order #${input.id} is already marked as shipped.`
                : `Order #${input.id} is ${existing.status} and can no longer be shipped.`,
          });
        }
        return { id: updated.id, status: updated.status };
      }),
  }),
});

export type AppRouter = typeof appRouter;
