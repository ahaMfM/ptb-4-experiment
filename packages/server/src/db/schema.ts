import { date, integer, numeric, pgTable, serial, text } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  contactName: text("contact_name").notNull(),
  company: text("company").notNull(),
  address: text("address").notNull(),
  email: text("email").notNull(),
  customerSince: date("customer_since").notNull(),
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
