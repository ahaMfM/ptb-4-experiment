import { initTRPC, TRPCError } from "@trpc/server";
import { desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/index.js";
import { customers } from "./db/schema.js";

export type { Customer } from "./db/schema.js";

const t = initTRPC.create();

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
        const [deleted] = await db
          .delete(customers)
          .where(eq(customers.id, input.id))
          .returning();
        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Customer not found",
          });
        }
        return deleted;
      }),
  }),
});

export type AppRouter = typeof appRouter;
