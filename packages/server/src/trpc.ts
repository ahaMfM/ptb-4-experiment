import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

/** Groups procedures into a router; see `router.ts` for the whole API. */
export const router = t.router;

/** A procedure anybody may call — only signing in and out qualify. */
export const publicProcedure = t.procedure;

/**
 * Everyone signs in as themselves before using the application, so every
 * procedure except signing in itself requires a signed-in user.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please sign in first.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * For anything that adds, changes or removes data — including placing an
 * order or recording a payment. A "read_only" team member is signed in like
 * everyone else but may only look, so this is refused for them.
 */
export const writeProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "full") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is read-only and cannot make changes.",
    });
  }
  return next({ ctx });
});
