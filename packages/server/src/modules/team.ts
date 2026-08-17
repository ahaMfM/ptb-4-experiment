import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { isUniqueViolation } from "../db/errors.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../password.js";
import { protectedProcedure } from "../trpc.js";

/**
 * The people who may sign in. This module owns the `users` table: nothing
 * outside it reads a stored password hash, and passwords only ever enter and
 * leave as plain text through `create` and `verifyCredentials`.
 *
 * Accounts are set up from inside the application by someone who is already
 * signed in — there is no self-registration and no password recovery.
 */

/** What the rest of the application may see of a user — never the password hash. */
export type PublicUser = {
  id: number;
  name: string;
  username: string;
};

/** A user as the Team page lists them, with the moment they were added. */
export type TeamMember = PublicUser & {
  /** ISO timestamp. */
  createdAt: string;
};

const userInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]+$/,
      "Username may only contain letters, numbers, dots, dashes and underscores",
    ),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

/**
 * Check a username/password pair. Returns the user on a match and null both
 * for an unknown username and for a wrong password — the caller cannot tell
 * the two apart, and so cannot leak which usernames exist.
 */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<PublicUser | null> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, name: user.name, username: user.username };
}

/**
 * The team sets its people up from within the application, but somebody has
 * to be able to sign in first. When there are no users at all, create a
 * starter account and say so on the console. Runs on startup, after the
 * schema exists.
 */
export async function ensureStarterAccount(): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) return;

  await db.insert(users).values({
    name: "Administrator",
    username: "admin",
    passwordHash: hashPassword("admin"),
  });
  console.log(
    'No team members found — created a starter account (username "admin", password "admin"). ' +
      "Sign in with it and add your team members on the Team page.",
  );
}

export const teamProcedures = {
  /** Everyone on the team, by name, so it is visible who can sign in. */
  list: protectedProcedure.query(async (): Promise<TeamMember[]> => {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.name, users.id);
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }),

  /**
   * Set up a new team member. There is no self-registration: only someone
   * who is already signed in can add a person, and passes the credentials
   * on to them directly.
   *
   * Fails with CONFLICT when the username is already taken.
   */
  create: protectedProcedure
    .input(userInput)
    .mutation(async ({ input }): Promise<TeamMember> => {
      let created;
      try {
        [created] = await db
          .insert(users)
          .values({
            name: input.name,
            username: input.username,
            passwordHash: hashPassword(input.password),
          })
          .returning({
            id: users.id,
            name: users.name,
            username: users.username,
            createdAt: users.createdAt,
          });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The username “${input.username}” is already taken.`,
          });
        }
        throw err;
      }
      return { ...created, createdAt: created.createdAt.toISOString() };
    }),
};
