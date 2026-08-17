import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { products } from "../db/schema.js";
import { orNotFound, writeExplainingConstraints } from "../errors.js";
import { protectedProcedure, router } from "../trpc.js";

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

/** The catalog of products on offer, with the stock we hold of each. */
export const productRouter = router({
  list: protectedProcedure.query(() => {
    return db.select().from(products).orderBy(products.name, products.id);
  }),
  byId: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, input.id));
      return orNotFound(product, "Product not found");
    }),
  create: protectedProcedure.input(productInput).mutation(async ({ input }) => {
    const [created] = await db.insert(products).values(input).returning();
    return created;
  }),
  update: protectedProcedure
    .input(productInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { id, ...values } = input;
      const [updated] = await db
        .update(products)
        .set(values)
        .where(eq(products.id, id))
        .returning();
      return orNotFound(updated, "Product not found");
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const [deleted] = await writeExplainingConstraints(
        () => db.delete(products).where(eq(products.id, input.id)).returning(),
        {
          foreignKeyViolation:
            "This product appears in existing orders and cannot be deleted.",
        },
      );
      return orNotFound(deleted, "Product not found");
    }),
});
