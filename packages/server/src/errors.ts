import { TRPCError } from "@trpc/server";

/**
 * Turning database outcomes into errors the web application can show:
 * a row that was not there, and a write the database refused.
 */

/** The row, or a NOT_FOUND error when the query came back empty. */
export function orNotFound<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message });
  }
  return row;
}

/**
 * Drizzle wraps driver errors ("Failed query: …") with the real Postgres
 * error in `cause`, so walk the cause chain when looking for the reason.
 */
function isCausedBy(err: unknown, reason: RegExp): boolean {
  while (err instanceof Error) {
    if (reason.test(err.message)) return true;
    err = err.cause;
  }
  return false;
}

/**
 * Run a write, and when the database refuses it because of a constraint,
 * report the given explanation instead of the raw driver error.
 */
export async function writeExplainingConstraints<T>(
  write: () => Promise<T>,
  explanations: {
    /** Shown when a unique constraint is violated, e.g. a taken username. */
    uniqueViolation?: string;
    /** Shown when other rows still reference the row being written. */
    foreignKeyViolation?: string;
  },
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (
      explanations.uniqueViolation &&
      isCausedBy(err, /unique|duplicate key/i)
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: explanations.uniqueViolation,
      });
    }
    if (explanations.foreignKeyViolation && isCausedBy(err, /foreign key/i)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: explanations.foreignKeyViolation,
      });
    }
    throw err;
  }
}
