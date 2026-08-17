import { TRPCError } from "@trpc/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../db/client.js";
import { isForeignKeyViolation } from "../db/errors.js";
import { products } from "../db/schema.js";
import { protectedProcedure, writeProcedure } from "../trpc.js";

/**
 * The product catalog and the stock it keeps. This module owns the `products`
 * table: the order side never touches stock or prices itself, it asks
 * `reserveStock` / `releaseStock` to move quantities and gets the prices to
 * bill back from the reservation.
 */

/** A product as the catalog presents it. */
export type Product = {
  id: number;
  name: string;
  description: string;
  /** Base64 data URL. */
  image: string;
  /** Price in EUR as a numeric string, e.g. "19.90". */
  price: string;
  stock: number;
};

/** One line of a stock movement. */
export type StockLine = {
  productId: number;
  quantity: number;
};

/** Roughly 2 MB of binary data once base64-encoded, plus data-URL header. */
const MAX_IMAGE_DATA_URL_LENGTH = 2_900_000;

const productInput = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().trim().min(1, "Description is required"),
  image: z
    .string()
    .regex(
      /^data:image\/(png|jpeg|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/,
      "A product picture is required",
    )
    .max(MAX_IMAGE_DATA_URL_LENGTH, "Picture must be 2 MB or smaller"),
  price: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "Price must be a positive amount like 19.90"),
  stock: z
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative"),
});

/**
 * Take `lines` off stock, all of them or none. Returns the price per unit of
 * each product at this moment, which is what the caller has to bill.
 *
 * Must run inside a transaction: on any of the failures below the caller's
 * transaction has to be rolled back.
 *  - BAD_REQUEST when a product is unknown or short on stock. Every offending
 *    line is reported in one message, so the user learns about all shortages
 *    at once instead of one per attempt.
 *  - CONFLICT when a concurrent reservation took the stock in between; the
 *    guarded update below makes it impossible to push stock below zero.
 */
export async function reserveStock(
  tx: Tx,
  lines: readonly StockLine[],
): Promise<Map<number, string>> {
  const productRows = await tx
    .select()
    .from(products)
    .where(inArray(products.id, lines.map((line) => line.productId)));
  const productById = new Map(productRows.map((p) => [p.id, p]));

  const problems: string[] = [];
  for (const line of lines) {
    const product = productById.get(line.productId);
    if (!product) {
      problems.push(`Product #${line.productId} no longer exists.`);
    } else if (product.stock < line.quantity) {
      problems.push(
        `Not enough stock for “${product.name}”: ${line.quantity} requested, ${product.stock} available.`,
      );
    }
  }
  if (problems.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: problems.join(" ") });
  }

  for (const line of lines) {
    const updated = await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${line.quantity}` })
      .where(
        and(eq(products.id, line.productId), gte(products.stock, line.quantity)),
      )
      .returning({ id: products.id });
    if (updated.length === 0) {
      const name = productById.get(line.productId)?.name ?? `#${line.productId}`;
      throw new TRPCError({
        code: "CONFLICT",
        message: `Stock of “${name}” changed while placing the order. Please try again.`,
      });
    }
  }

  return new Map(productRows.map((p) => [p.id, p.price]));
}

/** Put `lines` back on stock, e.g. when an order is cancelled. */
export async function releaseStock(
  tx: Tx,
  lines: readonly StockLine[],
): Promise<void> {
  for (const line of lines) {
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${line.quantity}` })
      .where(eq(products.id, line.productId));
  }
}

export const catalogProcedures = {
  /** The products on offer with their stock, by name. */
  list: protectedProcedure.query(
    async (): Promise<Product[]> =>
      db.select().from(products).orderBy(products.name, products.id),
  ),

  create: writeProcedure
    .input(productInput)
    .mutation(async ({ input }): Promise<Product> => {
      const [created] = await db.insert(products).values(input).returning();
      return created;
    }),

  /** Fails with NOT_FOUND when the product is gone. */
  update: writeProcedure
    .input(productInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<Product> => {
      const { id, ...values } = input;
      const [updated] = await db
        .update(products)
        .set(values)
        .where(eq(products.id, id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      return updated;
    }),

  /**
   * Fails with CONFLICT when the product appears in an order — order history
   * keeps what was actually sold — and with NOT_FOUND when it is already gone.
   */
  remove: writeProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<Product> => {
      let deleted;
      try {
        [deleted] = await db
          .delete(products)
          .where(eq(products.id, input.id))
          .returning();
      } catch (err) {
        if (isForeignKeyViolation(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This product appears in existing orders and cannot be deleted.",
          });
        }
        throw err;
      }
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      return deleted;
    }),
};
