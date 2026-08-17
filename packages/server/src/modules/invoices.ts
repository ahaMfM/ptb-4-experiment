import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../db/client.js";
import { customers, invoices, orders } from "../db/schema.js";
import { protectedProcedure } from "../trpc.js";

/**
 * Receivables. This module owns the `invoices` table.
 *
 * Invoices are never created by hand: exactly one is issued when an order is
 * shipped, through `issueInvoice`. From then on the only thing that changes is
 * the payment, and that only once — an invoice recorded as paid stays as it
 * was first recorded.
 */

/** An invoice as it is stored. */
export type Invoice = {
  id: number;
  orderId: number;
  /** Total invoiced amount in EUR as a numeric string, e.g. "119.80". */
  amount: string;
  issuedAt: Date;
  /** Plain calendar date the customer paid, YYYY-MM-DD; null while unpaid. */
  paidAt: string | null;
};

/** An invoice with the customer it is addressed to, as the Invoices page lists them. */
export type InvoiceRecord = Omit<Invoice, "issuedAt"> & {
  /** ISO timestamp. */
  issuedAt: string;
  customerId: number;
  contactName: string;
  company: string;
};

/**
 * A payment date: a real calendar date in YYYY-MM-DD. JS Date rolls over
 * out-of-range days (Feb 31 → Mar 3), so the components have to survive a
 * round trip unchanged.
 */
const paidAtInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Payment date must be a real calendar date");

/**
 * Issue the invoice for a shipped order. `amount` is the order total, frozen
 * at this moment. Runs in the caller's transaction so shipping and invoicing
 * are one step; the unique `order_id` keeps it to one invoice per order.
 */
export async function issueInvoice(
  tx: Tx,
  orderId: number,
  amount: string,
): Promise<{ id: number; amount: string }> {
  const [invoice] = await tx
    .insert(invoices)
    .values({ orderId, amount })
    .returning();
  return { id: invoice.id, amount: invoice.amount };
}

export const invoiceProcedures = {
  /**
   * How many invoices are still waiting for payment. Shown on the
   * start screen so open receivables are visible right away.
   */
  unpaidCount: protectedProcedure.query(async (): Promise<number> => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(isNull(invoices.paidAt));
    return row?.count ?? 0;
  }),

  /**
   * All invoices, newest first, each with the customer it is addressed
   * to and whether/when it was paid. Pass `unpaidOnly` to see just the
   * outstanding ones.
   */
  list: protectedProcedure
    .input(z.object({ unpaidOnly: z.boolean().optional() }).optional())
    .query(async ({ input }): Promise<InvoiceRecord[]> => {
      const rows = await db
        .select({
          id: invoices.id,
          orderId: invoices.orderId,
          amount: invoices.amount,
          issuedAt: invoices.issuedAt,
          paidAt: invoices.paidAt,
          customerId: customers.id,
          contactName: customers.contactName,
          company: customers.company,
        })
        .from(invoices)
        .innerJoin(orders, eq(orders.id, invoices.orderId))
        .innerJoin(customers, eq(customers.id, orders.customerId))
        .where(input?.unpaidOnly ? isNull(invoices.paidAt) : undefined)
        .orderBy(desc(invoices.issuedAt), desc(invoices.id));
      return rows.map((row) => ({ ...row, issuedAt: row.issuedAt.toISOString() }));
    }),

  /**
   * Record that the customer paid an invoice, together with the date of
   * payment. A one-time action: fails with CONFLICT when the invoice is
   * already recorded as paid, and with NOT_FOUND when there is no such
   * invoice.
   */
  markPaid: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), paidAt: paidAtInput }))
    .mutation(async ({ input }): Promise<Invoice> => {
      // The `paid_at IS NULL` guard is what makes this one-time, even when
      // two people record the payment at the same moment.
      const [updated] = await db
        .update(invoices)
        .set({ paidAt: input.paidAt })
        .where(and(eq(invoices.id, input.id), isNull(invoices.paidAt)))
        .returning();
      if (!updated) {
        const [existing] = await db
          .select({ paidAt: invoices.paidAt })
          .from(invoices)
          .where(eq(invoices.id, input.id));
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: `Invoice #${input.id} is already recorded as paid on ${existing.paidAt}.`,
        });
      }
      return updated;
    }),
};
