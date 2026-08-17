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
 * Today's date in the user's timezone as "YYYY-MM-DD" — the format date
 * inputs and the server expect. "en-CA" is the shortest way to that shape.
 */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

/** "2 × Espresso beans, 1 × Grinder" — what an order contains, in one line. */
export function formatOrderContents(
  items: readonly { quantity: number; productName: string }[],
): string {
  return items
    .map((item) => `${item.quantity} × ${item.productName}`)
    .join(", ");
}
