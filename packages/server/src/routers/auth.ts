import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { endSession, issueSession } from "../context.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { verifyPassword } from "../password.js";
import { publicProcedure, router } from "../trpc.js";

/** Signing in and out, and asking who is signed in. */
export const authRouter = router({
  /** Who is currently signed in — null when nobody is. */
  me: publicProcedure.query(({ ctx }) => ctx.user),
  signIn: publicProcedure
    .input(
      z.object({
        username: z.string().trim().toLowerCase().min(1, "Username is required"),
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username));
      // One message for both cases, so the form does not reveal which
      // usernames exist.
      if (!user || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Wrong username or password.",
        });
      }
      await issueSession(user.id, ctx.resHeaders);
      return { id: user.id, name: user.name, username: user.username };
    }),
  signOut: publicProcedure.mutation(async ({ ctx }) => {
    await endSession(ctx.sessionToken, ctx.resHeaders);
    return { ok: true };
  }),
});
