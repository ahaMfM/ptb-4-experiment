/**
 * Recognizing constraint violations means knowing how the driver reports
 * them, so that knowledge stays next to the database. Callers ask a question
 * ("was this a foreign key violation?") instead of matching on messages.
 *
 * Drizzle wraps driver errors ("Failed query: …") with the real Postgres
 * error in `cause`, so both checks walk the cause chain.
 */

function causeChainMatches(err: unknown, pattern: RegExp): boolean {
  while (err instanceof Error) {
    if (pattern.test(err.message)) return true;
    err = err.cause;
  }
  return false;
}

/** A row could not be written or removed because another row references it. */
export function isForeignKeyViolation(err: unknown): boolean {
  return causeChainMatches(err, /foreign key/i);
}

/** A value that has to be unique was already taken (e.g. a username). */
export function isUniqueViolation(err: unknown): boolean {
  return causeChainMatches(err, /unique|duplicate key/i);
}
