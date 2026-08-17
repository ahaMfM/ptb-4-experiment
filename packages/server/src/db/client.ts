import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as schema from "./schema.js";

/**
 * The embedded database. Everything that knows about tables and columns lives
 * in `db/` and in the feature modules under `modules/` — nothing above them
 * touches `db` or `schema` directly.
 */

const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/pglite",
);

mkdirSync(dataDir, { recursive: true });

const client = new PGlite(dataDir);

export const db = drizzle(client, { schema });

export type Db = typeof db;

/** The handle a `db.transaction(…)` callback receives. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Anything queries can run against. Helpers shared between a plain call and a
 * call inside a transaction take this, so the caller decides the transaction.
 */
export type Queryable = Db | Tx;

/**
 * Create the schema on startup (embedded database, no external migration
 * step) and bring databases from earlier versions up to date. Must run before
 * anything queries the database.
 */
export async function initDb(): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "username" text NOT NULL UNIQUE,
      "password_hash" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS "customers" (
      "id" serial PRIMARY KEY,
      "first_name" text NOT NULL,
      "family_name" text NOT NULL,
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
    -- Upgrade databases from before the contact person's name was split into a
    -- first and family name: split the old single field on its first space
    -- and drop it, so the split only ever runs once.
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "first_name" text;
    ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "family_name" text;
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'contact_name'
      ) THEN
        UPDATE "customers" SET
          "first_name" = split_part("contact_name", ' ', 1),
          "family_name" = CASE
            WHEN position(' ' in "contact_name") > 0
              THEN trim(substring("contact_name" from position(' ' in "contact_name") + 1))
            ELSE ''
          END
        WHERE "first_name" IS NULL;
        ALTER TABLE "customers" ALTER COLUMN "first_name" SET NOT NULL;
        ALTER TABLE "customers" ALTER COLUMN "family_name" SET NOT NULL;
        ALTER TABLE "customers" DROP COLUMN "contact_name";
      END IF;
    END $$;
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
}
