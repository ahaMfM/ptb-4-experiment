import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hashPassword } from "../password.js";
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
    CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "username" text NOT NULL UNIQUE,
      "password_hash" text NOT NULL,
      "role" text NOT NULL DEFAULT 'member',
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    -- Upgrade databases from before roles existed: everyone set up so far
    -- keeps full access, same as today.
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'member';
    CREATE TABLE IF NOT EXISTS "customers" (
      "id" serial PRIMARY KEY,
      "contact_name" text NOT NULL,
      "company" text NOT NULL,
      "address" text NOT NULL,
      "email" text NOT NULL,
      "customer_since" date NOT NULL,
      "created_by_id" integer REFERENCES "users"("id"),
      "created_at" timestamptz
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
      "created_by_id" integer REFERENCES "users"("id"),
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    -- Upgrade databases created before orders had a status: existing orders
    -- get the default, i.e. they count as open.
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'open';
    -- Upgrade databases from before we tracked who recorded what. The new
    -- columns stay NULL on existing rows: for those we simply do not know.
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "created_by_id" integer REFERENCES "users"("id");
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "created_by_id" integer REFERENCES "users"("id");
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "created_at" timestamptz;
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
    CREATE TABLE IF NOT EXISTS "sessions" (
      "token" text PRIMARY KEY,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    -- Sessions that ran out are worthless; sweep them on startup.
    DELETE FROM "sessions" WHERE "expires_at" < now();
  `);

  await seedStarterUser();
}

/**
 * The team sets its people up from within the application, but somebody has
 * to be able to sign in first. When there are no users at all, create a
 * starter account and say so on the console.
 */
async function seedStarterUser(): Promise<void> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(schema.users).values({
    name: "Administrator",
    username: "admin",
    passwordHash: hashPassword("admin"),
  });
  console.log(
    'No team members found — created a starter account (username "admin", password "admin"). ' +
      "Sign in with it and add your team members on the Team page.",
  );
}
