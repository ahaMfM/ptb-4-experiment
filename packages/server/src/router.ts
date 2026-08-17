import { authRouter } from "./routers/auth.js";
import { customerRouter } from "./routers/customers.js";
import { invoiceRouter } from "./routers/invoices.js";
import { orderRouter } from "./routers/orders.js";
import { productRouter } from "./routers/products.js";
import { userRouter } from "./routers/users.js";
import { router } from "./trpc.js";

/**
 * The whole API the web application talks to, one sub-router per area.
 * Each of them lives in `routers/`.
 */
export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  customer: customerRouter,
  product: productRouter,
  order: orderRouter,
  invoice: invoiceRouter,
});

export type AppRouter = typeof appRouter;

/** The record shapes the web application names in its own types. */
export type { CustomerRecord } from "./routers/customers.js";
export type { Product, PublicUser } from "./db/schema.js";
