import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { endSession, issueSession } from "../sessions.js";
import { publicProcedure } from "../trpc.js";
import { verifyCredentials, type PublicUser } from "./team.js";

/**
 * Signing in and out. These are the only procedures reachable without a
 * session; everything else is built on `protectedProcedure`.
 *
 * Signing in reports one and the same error for an unknown username and a
 * wrong password (UNAUTHORIZED, "Wrong username or password."), so the form
 * cannot be used to find out which usernames exist.
 */
export const authProcedures = {
  /** Who is currently signed in — null when nobody is. */
  me: publicProcedure.query(({ ctx }): PublicUser | null => ctx.user),

  signIn: publicProcedure
    .input(
      z.object({
        username: z.string().trim().toLowerCase().min(1, "Username is required"),
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ input, ctx }): Promise<PublicUser> => {
      const user = await verifyCredentials(input.username, input.password);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Wrong username or password.",
        });
      }
      await issueSession(user.id, ctx.resHeaders);
      return user;
    }),

  /** Always succeeds, whether or not there was a session to end. */
  signOut: publicProcedure.mutation(async ({ ctx }) => {
    await endSession(ctx.sessionToken, ctx.resHeaders);
    return { ok: true };
  }),
};
