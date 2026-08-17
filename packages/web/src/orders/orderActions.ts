import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "../lib/format";
import { useTRPC } from "../trpc";

/**
 * The two things one can do to an open order, shared by the orders table
 * and the order dialog: both offer them, and both have to refresh the
 * same views afterwards.
 */

/**
 * Mark an order as sent out. Shipping issues the order's invoice, so the
 * invoice views — including the unpaid count on the start screen — are
 * refreshed along with the order itself.
 */
export function useShipOrder() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.order.markShipped.mutationOptions({
      onSuccess: async (order) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(
            trpc.order.byId.queryFilter({ id: order.id }),
          ),
          queryClient.invalidateQueries(trpc.invoice.pathFilter()),
        ]);
      },
    }),
  );
}

/**
 * Call an order off again. The ordered quantities go back on stock, so the
 * product list is refreshed along with the order itself.
 */
export function useCancelOrder() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.order.cancel.mutationOptions({
      onSuccess: async (order) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(
            trpc.order.byId.queryFilter({ id: order.id }),
          ),
          queryClient.invalidateQueries(trpc.product.list.queryFilter()),
        ]);
      },
    }),
  );
}

/** Cancelling moves goods back on stock, so ask before doing it. */
export function confirmOrderCancellation(orderId: number): boolean {
  return window.confirm(
    `Cancel order #${orderId}? The ordered products go back on stock.`,
  );
}

/** What to report once an order has gone out and its invoice exists. */
export function shipmentMessage(shipped: {
  id: number;
  invoiceId: number;
  invoiceAmount: string;
}): string {
  return `Order #${shipped.id} was shipped. Invoice #${shipped.invoiceId} over ${formatPrice(shipped.invoiceAmount)} was issued.`;
}

/** What to report once an order has been called off. */
export function cancellationMessage(cancelled: { id: number }): string {
  return `Order #${cancelled.id} was cancelled. The products are back on stock.`;
}
