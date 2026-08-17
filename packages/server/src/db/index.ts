import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as schema from "./schema.js";

const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/pglite",
);

mkdirSync(dataDir, { recursive: true });

const client = new PGlite(dataDir);

export const db = drizzle(client, { schema });

/** Create the schema on startup (embedded database, no external migration step). */
export async function initDb(): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS "customers" (
      "id" serial PRIMARY KEY,
      "contact_name" text NOT NULL,
      "company" text NOT NULL,
      "address" text NOT NULL,
      "email" text NOT NULL,
      "customer_since" date NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "products" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "description" text NOT NULL,
      "image" text NOT NULL,
      "price" numeric(10,2) NOT NULL,
      "stock" integer NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "orders" (
      "id" serial PRIMARY KEY,
      "customer_id" integer NOT NULL REFERENCES "customers"("id"),
      "status" text NOT NULL DEFAULT 'open',
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    -- Upgrade databases created before orders had a status: existing orders
    -- get the default, i.e. they count as open.
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'open';
    CREATE TABLE IF NOT EXISTS "order_items" (
      "id" serial PRIMARY KEY,
      "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "product_id" integer NOT NULL REFERENCES "products"("id"),
      "quantity" integer NOT NULL CHECK ("quantity" > 0),
      "unit_price" numeric(10,2) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "invoices" (
      "id" serial PRIMARY KEY,
      "order_id" integer NOT NULL UNIQUE REFERENCES "orders"("id"),
      "amount" numeric(10,2) NOT NULL,
      "issued_at" timestamptz NOT NULL DEFAULT now(),
      "paid_at" date
    );
  `);
}
