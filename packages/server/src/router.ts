import { initTRPC } from "@trpc/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/index.js";
import { customers } from "./db/schema.js";

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
    list: t.procedure.query(() =>
      db
        .select()
        .from(customers)
        .orderBy(desc(customers.customerSince), desc(customers.id)),
    ),
    create: t.procedure.input(customerInput).mutation(async ({ input }) => {
      const [created] = await db.insert(customers).values(input).returning();
      return created;
    }),
  }),
});

export type AppRouter = typeof appRouter;
