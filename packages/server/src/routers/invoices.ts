import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { isoDateString, isRealCalendarDate } from "../dates.js";
import { db } from "../db/index.js";
import { customers, invoices, orders } from "../db/schema.js";
import { orNotFound } from "../errors.js";
import { protectedProcedure, router } from "../trpc.js";

/** One invoice per shipped order; unpaid until a payment date is recorded. */
export const invoiceRouter = router({
  /**
   * How many invoices are still waiting for payment. Shown on the
   * start screen so open receivables are visible right away.
   */
  unpaidCount: protectedProcedure.query(async () => {
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
    .query(async ({ input }) => {
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
      return rows.map((row) => ({
        ...row,
        issuedAt: row.issuedAt.toISOString(),
      }));
    }),
  /**
   * Record that the customer paid an invoice, together with the date of
   * payment. The `paid_at IS NULL` guard makes this a one-time action:
   * an invoice that is already paid stays as it was first recorded.
   */
  markPaid: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        paidAt: isoDateString("Payment date must be YYYY-MM-DD").refine(
          isRealCalendarDate,
          "Payment date must be a real calendar date",
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(invoices)
        .set({ paidAt: input.paidAt })
        .where(and(eq(invoices.id, input.id), isNull(invoices.paidAt)))
        .returning();
      if (updated) return updated;

      const [existing] = await db
        .select({ paidAt: invoices.paidAt })
        .from(invoices)
        .where(eq(invoices.id, input.id));
      const { paidAt } = orNotFound(existing, "Invoice not found");
      throw new TRPCError({
        code: "CONFLICT",
        message: `Invoice #${input.id} is already recorded as paid on ${paidAt}.`,
      });
    }),
});
