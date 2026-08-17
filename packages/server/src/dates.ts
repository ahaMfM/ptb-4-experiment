import { z } from "zod";

/** A plain calendar day as "YYYY-MM-DD" — how dates travel to and from the web. */
export function isoDateString(message: string) {
  return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message);
}

/**
 * Whether an ISO date names a day that really exists. JS Date rolls
 * out-of-range days over (Feb 31 → Mar 3), so check that the components
 * survive a round trip unchanged.
 */
export function isRealCalendarDate(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
