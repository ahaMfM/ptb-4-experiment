/** A priced line of an order: how many, and at what price per unit. */
type LineItem = {
  quantity: number;
  /** Numeric string as stored, e.g. "19.90". */
  unitPrice: string;
};

/**
 * What a set of line items comes to, as a numeric string like "119.80" —
 * the same shape prices and amounts have everywhere else.
 */
export function lineItemsTotal(items: readonly LineItem[]): string {
  return items
    .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
    .toFixed(2);
}

/**
 * Pick one order's lines out of items fetched for several orders at once.
 * The `orderId` is dropped again: within an order it says nothing.
 */
export function orderLines<I extends LineItem & { orderId: number }>(
  items: readonly I[],
  orderId: number,
): { items: Omit<I, "orderId">[]; total: string } {
  const lines = items
    .filter((item) => item.orderId === orderId)
    .map(({ orderId: _orderId, ...line }) => line);
  return { items: lines, total: lineItemsTotal(lines) };
}
