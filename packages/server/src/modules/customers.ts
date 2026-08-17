import { TRPCError } from "@trpc/server";
import { desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, type Queryable } from "../db/client.js";
import { isForeignKeyViolation } from "../db/errors.js";
import { customers, users } from "../db/schema.js";
import { protectedProcedure } from "../trpc.js";

/**
 * The customer book. This module owns the `customers` table; other modules
 * that need to know whether a customer exists ask `requireCustomer`.
 *
 * Who recorded a customer and when is written once, when the customer is
 * first entered, and deliberately left untouched by later edits.
 */

/** A customer as it is stored. */
export type Customer = {
  id: number;
  contactName: string;
  company: string;
  address: string;
  email: string;
  /** Not every customer gives us one. */
  vatNumber: string | null;
  /** Plain calendar date, YYYY-MM-DD. */
  customerSince: string;
  /** Null for entries from before everyone signed in. */
  createdById: number | null;
  createdAt: Date | null;
};

/**
 * A customer as the web application sees it: the stored fields plus the
 * name of the team member who recorded the customer and when. Both are
 * null for entries from before everyone signed in.
 */
export type CustomerRecord = Omit<Customer, "createdById" | "createdAt"> & {
  /** ISO timestamp, null for entries from before everyone signed in. */
  createdAt: string | null;
  recordedBy: string | null;
};

/** What `update` and `remove` echo back: the stored row, `createdAt` as ISO. */
export type StoredCustomer = Omit<Customer, "createdAt"> & {
  createdAt: string | null;
};

const customerInput = z.object({
  contactName: z.string().trim().min(1, "Contact name is required"),
  company: z.string().trim().min(1, "Company is required"),
  address: z.string().trim().min(1, "Address is required"),
  email: z.email("A valid e-mail address is required"),
  vatNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  customerSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

/**
 * Fail with NOT_FOUND unless the customer exists. Takes the connection so it
 * can take part in the caller's transaction.
 */
export async function requireCustomer(
  conn: Queryable,
  customerId: number,
): Promise<void> {
  const [customer] = await conn
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId));
  if (!customer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
  }
}

/** Escape LIKE wildcards so a search for "100%" matches literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export const customerProcedures = {
  /**
   * The customer book, newest customer relationship first. `search` matches
   * contact name or company, case-insensitively, as a substring.
   */
  list: protectedProcedure
    .input(z.object({ search: z.string().trim().optional() }).optional())
    .query(async ({ input }): Promise<CustomerRecord[]> => {
      const term = input?.search;
      const pattern = term ? likePattern(term) : null;
      const rows = await db
        .select({
          id: customers.id,
          contactName: customers.contactName,
          company: customers.company,
          address: customers.address,
          email: customers.email,
          vatNumber: customers.vatNumber,
          customerSince: customers.customerSince,
          createdAt: customers.createdAt,
          // Who recorded the customer; null for old entries.
          recordedBy: users.name,
        })
        .from(customers)
        .leftJoin(users, eq(users.id, customers.createdById))
        .where(
          pattern
            ? or(
                ilike(customers.contactName, pattern),
                ilike(customers.company, pattern),
              )
            : undefined,
        )
        .orderBy(desc(customers.customerSince), desc(customers.id));
      return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt?.toISOString() ?? null,
      }));
    }),

  create: protectedProcedure
    .input(customerInput)
    .mutation(async ({ input, ctx }): Promise<CustomerRecord> => {
      // Remember who recorded the customer and when.
      const [created] = await db
        .insert(customers)
        .values({ ...input, createdById: ctx.user.id, createdAt: new Date() })
        .returning();
      const { createdById: _createdById, ...rest } = created;
      return {
        ...rest,
        createdAt: created.createdAt?.toISOString() ?? null,
        recordedBy: ctx.user.name,
      };
    }),

  /** Fails with NOT_FOUND when the customer is gone. */
  update: protectedProcedure
    .input(customerInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<StoredCustomer> => {
      const { id, ...values } = input;
      // Editing deliberately leaves created_by/created_at untouched:
      // they record who first entered the customer.
      const [updated] = await db
        .update(customers)
        .set(values)
        .where(eq(customers.id, id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      return { ...updated, createdAt: updated.createdAt?.toISOString() ?? null };
    }),

  /**
   * Fails with CONFLICT when the customer has orders — order history outlives
   * the customer book — and with NOT_FOUND when they are already gone.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<StoredCustomer> => {
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
            message: "This customer has orders on record and cannot be deleted.",
          });
        }
        throw err;
      }
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      return { ...deleted, createdAt: deleted.createdAt?.toISOString() ?? null };
    }),
};
