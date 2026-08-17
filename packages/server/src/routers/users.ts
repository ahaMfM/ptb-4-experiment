import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { writeExplainingConstraints } from "../errors.js";
import { hashPassword } from "../password.js";
import { protectedProcedure, router, writeProcedure } from "../trpc.js";

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
  // Full access unless the person setting the account up says otherwise, so
  // everyone set up so far — and anyone added without a choice — keeps
  // being able to do everything, as before roles existed.
  role: z.enum(["full", "read_only"]).default("full"),
});

/** The columns of a team member the rest of the application may see. */
const teamMemberColumns = {
  id: users.id,
  name: users.name,
  username: users.username,
  role: users.role,
  createdAt: users.createdAt,
};

/** The people on the team who can sign in. */
export const userRouter = router({
  /** Everyone on the team, so it is visible who can sign in. */
  list: protectedProcedure.query(async () => {
    const rows = await db
      .select(teamMemberColumns)
      .from(users)
      .orderBy(users.name, users.id);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }),
  /**
   * Set up a new team member. There is no self-registration: only someone
   * who is already signed in can add a person, and passes the credentials
   * on to them directly.
   */
  create: writeProcedure.input(userInput).mutation(async ({ input }) => {
    const [created] = await writeExplainingConstraints(
      () =>
        db
          .insert(users)
          .values({
            name: input.name,
            username: input.username,
            passwordHash: hashPassword(input.password),
            role: input.role,
          })
          .returning(teamMemberColumns),
      {
        uniqueViolation: `The username “${input.username}” is already taken.`,
      },
    );
    return { ...created, createdAt: created.createdAt.toISOString() };
  }),
});
