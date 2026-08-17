import { desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { isoDateString } from "../dates.js";
import { db } from "../db/index.js";
import {
  customers,
  orderItems,
  orders,
  products,
  users,
  type Customer,
} from "../db/schema.js";
import { orNotFound, writeExplainingConstraints } from "../errors.js";
import { orderLines } from "../line-items.js";
import { protectedProcedure, router, writeProcedure } from "../trpc.js";

/**
 * A customer as the web application sees it: the stored fields plus the
 * name of the team member who recorded the customer and when. Both are
 * null for entries from before everyone signed in.
 */
export type CustomerRecord = Omit<Customer, "createdById" | "createdAt"> & {
  createdAt: string | null;
  recordedBy: string | null;
};

const customerInput = z.object({
  contactName: z.string().trim().min(1, "Contact name is required"),
  company: z.string().trim().min(1, "Company is required"),
  address: z.string().trim().min(1, "Address is required"),
  email: z.email("A valid e-mail address is required"),
  customerSince: isoDateString("Date must be YYYY-MM-DD"),
});

/** Customers travel with `createdAt` as an ISO string rather than a Date. */
function withIsoCreatedAt<T extends { createdAt: Date | null }>(customer: T) {
  return {
    ...customer,
    createdAt: customer.createdAt?.toISOString() ?? null,
  };
}

/** Turn a search term into a LIKE pattern, escaping wildcards so "100%" matches literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export const customerRouter = router({
  list: protectedProcedure
    .input(z.object({ search: z.string().trim().optional() }).optional())
    .query(async ({ input }): Promise<CustomerRecord[]> => {
      const term = input?.search;
      const rows = await db
        .select({
          id: customers.id,
          contactName: customers.contactName,
          company: customers.company,
          address: customers.address,
          email: customers.email,
          customerSince: customers.customerSince,
          createdAt: customers.createdAt,
          // Who recorded the customer; null for old entries.
          recordedBy: users.name,
        })
        .from(customers)
        .leftJoin(users, eq(users.id, customers.createdById))
        .where(
          term
            ? or(
                ilike(customers.contactName, likePattern(term)),
                ilike(customers.company, likePattern(term)),
              )
            : undefined,
        )
        .orderBy(desc(customers.customerSince), desc(customers.id));
      return rows.map(withIsoCreatedAt);
    }),
  /**
   * All orders a customer has placed, newest first, each with its
   * current status (open / shipped / cancelled) and line items.
   */
  orders: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, input.customerId));
      orNotFound(customer, "Customer not found");

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

      return orderRows.map((order) => ({
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        recordedBy: order.recordedBy,
        ...orderLines(itemRows, order.id),
      }));
    }),
  create: writeProcedure
    .input(customerInput)
    .mutation(async ({ input, ctx }): Promise<CustomerRecord> => {
      // Remember who recorded the customer and when.
      const [created] = await db
        .insert(customers)
        .values({ ...input, createdById: ctx.user.id, createdAt: new Date() })
        .returning();
      const { createdById: _createdById, ...stored } = created;
      return { ...withIsoCreatedAt(stored), recordedBy: ctx.user.name };
    }),
  update: writeProcedure
    .input(customerInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { id, ...values } = input;
      // Editing deliberately leaves created_by/created_at untouched:
      // they record who first entered the customer.
      const [updated] = await db
        .update(customers)
        .set(values)
        .where(eq(customers.id, id))
        .returning();
      return withIsoCreatedAt(orNotFound(updated, "Customer not found"));
    }),
  remove: writeProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const [deleted] = await writeExplainingConstraints(
        () => db.delete(customers).where(eq(customers.id, input.id)).returning(),
        {
          foreignKeyViolation:
            "This customer has orders on record and cannot be deleted.",
        },
      );
      return withIsoCreatedAt(orNotFound(deleted, "Customer not found"));
    }),
});
