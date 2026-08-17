import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./sessions.js";

/**
 * The tRPC building blocks every feature module builds its procedures from.
 * Keeping them here means the modules never set tRPC up themselves and the
 * sign-in rule below is stated exactly once.
 */

const t = initTRPC.context<Context>().create();

/** Groups procedures into a namespace of the API. */
export const router = t.router;

/** Reachable without signing in — only signing in itself needs this. */
export const publicProcedure = t.procedure;

/**
 * Everyone signs in as themselves before using the application, so every
 * procedure except signing in itself requires a signed-in user. Resolvers
 * built on this can rely on `ctx.user` being present.
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
