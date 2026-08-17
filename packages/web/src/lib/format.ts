/**
 * How stored values are shown to the user. The server speaks plain strings —
 * amounts as numeric strings, plain dates as YYYY-MM-DD, timestamps as ISO —
 * and this module is the only place that turns them into display text.
 */

const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

/** Format a numeric string like "19.90" as a localized EUR amount. */
export function formatPrice(price: string | number): string {
  const value = Number(price);
  return Number.isFinite(value) ? priceFormatter.format(value) : String(price);
}

/** Format a plain date like "2024-05-01" for display, without timezone shifts. */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format an ISO timestamp with date and time for display. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Today as YYYY-MM-DD in the user's own timezone — what somebody filling in a
 * date field means by "today".
 */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

/**
 * Today as YYYY-MM-DD in UTC. Used for values that are about the record
 * rather than about the user, such as an export's filename, so that two
 * people exporting at the same moment get the same name.
 */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
