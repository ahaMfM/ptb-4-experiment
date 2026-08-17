import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "./db/index.js";
import { sessions, users, type PublicUser } from "./db/schema.js";

const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;
const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export type Context = {
  /** The signed-in user, or null when nobody is signed in. */
  user: PublicUser | null;
  /** The raw session token from the cookie, needed to end the session. */
  sessionToken: string | null;
  /** Response headers of the current request, used to (un)set the cookie. */
  resHeaders: Headers;
};

function readSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE && rest.length > 0) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/** Resolve the session cookie (if any) to the signed-in user for this request. */
export async function createContext({
  req,
  resHeaders,
}: FetchCreateContextFnOptions): Promise<Context> {
  const token = readSessionToken(req);
  if (!token) return { user: null, sessionToken: null, resHeaders };

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.token, token));

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) await db.delete(sessions).where(eq(sessions.token, token));
    return { user: null, sessionToken: null, resHeaders };
  }

  return {
    user: { id: row.id, name: row.name, username: row.username },
    sessionToken: token,
    resHeaders,
  };
}

/** Start a session for the user and put its token into an HttpOnly cookie. */
export async function issueSession(
  userId: number,
  resHeaders: Headers,
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  resHeaders.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  );
}

/** End the session (sign out): forget it server-side and clear the cookie. */
export async function endSession(
  sessionToken: string | null,
  resHeaders: Headers,
): Promise<void> {
  if (sessionToken) {
    await db.delete(sessions).where(eq(sessions.token, sessionToken));
  }
  resHeaders.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
}
