import { authProcedures } from "./modules/auth.js";
import { catalogProcedures } from "./modules/catalog.js";
import { customerProcedures } from "./modules/customers.js";
import { invoiceProcedures } from "./modules/invoices.js";
import { customerOrdersProcedure, orderProcedures } from "./modules/orders.js";
import { teamProcedures } from "./modules/team.js";
import { router } from "./trpc.js";

/**
 * The whole API in one place: which namespace each feature module's procedures
 * are reachable under. Inputs, rules and error modes belong to the modules —
 * nothing is implemented here.
 *
 * Every procedure except `auth.*` requires a signed-in user (see trpc.ts).
 */
export const appRouter = router({
  auth: router(authProcedures),
  user: router(teamProcedures),
  customer: router({
    ...customerProcedures,
    // A customer's order history: the customer book decides who exists, the
    // order module knows what they ordered.
    orders: customerOrdersProcedure,
  }),
  product: router(catalogProcedures),
  order: router(orderProcedures),
  invoice: router(invoiceProcedures),
});

export type AppRouter = typeof appRouter;

/**
 * The shapes the API speaks in. The web client imports these instead of
 * inferring them, so what crosses the wire is written down rather than being
 * whatever the database happens to return.
 */
export type { PublicUser, TeamMember } from "./modules/team.js";
export { USER_ROLES } from "./db/schema.js";
export type { UserRole } from "./db/schema.js";
export type { Customer, CustomerRecord } from "./modules/customers.js";
export type { Product } from "./modules/catalog.js";
export type {
  CustomerOrder,
  Order,
  OrderDetail,
  OrderItem,
  OrderLine,
  OrderStatus,
  OrderSummary,
} from "./modules/orders.js";
export { ORDER_STATUSES } from "./modules/orders.js";
export type { Invoice, InvoiceRecord } from "./modules/invoices.js";
