import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * The people on the team who use the application. Accounts are set up from
 * within the application by someone who is already signed in — there is no
 * self-registration and no password recovery.
 */
/**
 * "member" can do everything; "viewer" can look at customers, products,
 * orders and invoices but cannot create, edit or remove anything, place an
 * order, or record a payment. New team members are "member" unless said
 * otherwise, so everyone keeps working as before by default.
 */
export const USER_ROLES = ["member", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<UserRole>().notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;

/** What the rest of the application may see of a user — never the password hash. */
export type PublicUser = Pick<User, "id" | "name" | "username" | "role">;

/** A signed-in browser session, identified by a random token kept in a cookie. */
export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Session = typeof sessions.$inferSelect;

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  contactName: text("contact_name").notNull(),
  company: text("company").notNull(),
  address: text("address").notNull(),
  email: text("email").notNull(),
  customerSince: date("customer_since").notNull(),
  /**
   * Who recorded the customer and when. Both stay null for entries from
   * before everyone signed in — there we simply do not know.
   */
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export type Customer = typeof customers.$inferSelect;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  /** Product picture stored as a base64 data URL. */
  image: text("image").notNull(),
  /** Price in EUR, kept as a numeric string (e.g. "19.90") to avoid float rounding. */
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull(),
});

export type Product = typeof products.$inferSelect;

/** Lifecycle of an order. Newly placed orders start out as "open". */
export const ORDER_STATUSES = ["open", "shipped", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  status: text("status").$type<OrderStatus>().notNull().default("open"),
  /**
   * Who recorded the order; `createdAt` below is when. Null for orders
   * from before everyone signed in — there we do not know who it was.
   */
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof orders.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  /** Price per unit at the time the order was placed (prices may change later). */
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;

/**
 * One invoice per shipped order, created automatically when the order is
 * marked as shipped. The amount is frozen at shipping time from the order's
 * line items. An invoice is unpaid until `paidAt` is set.
 */
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .unique()
    .references(() => orders.id),
  /** Total invoiced amount in EUR, as a numeric string (e.g. "119.80"). */
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Date the customer paid; null while the invoice is unpaid. */
  paidAt: date("paid_at"),
});

export type Invoice = typeof invoices.$inferSelect;
