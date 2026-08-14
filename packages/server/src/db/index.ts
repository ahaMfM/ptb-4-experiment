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
  `);
}
