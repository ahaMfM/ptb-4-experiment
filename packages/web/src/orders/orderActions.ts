import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "../lib/format";
import { useTRPC } from "../trpc";

/**
 * The two things one can do to an open order, shared by the orders table
 * and the order dialog: both offer them, and both have to refresh the
 * same views afterwards.
 */

/**
 * Optimistically set an order's status in both the list and detail caches
 * before the request resolves, so the badge flips the instant the user
 * acts. Returns a snapshot to restore if the request turns out to fail.
 */
function setOptimisticStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  trpc: ReturnType<typeof useTRPC>,
  orderId: number,
  status: "shipped" | "cancelled",
) {
  const listKey = trpc.order.list.queryKey();
  const detailKey = trpc.order.byId.queryKey({ id: orderId });

  const previousList = queryClient.getQueryData(listKey);
  const previousDetail = queryClient.getQueryData(detailKey);

  queryClient.setQueryData(listKey, (orders: typeof previousList) =>
    orders?.map((order) =>
      order.id === orderId ? { ...order, status } : order,
    ),
  );
  queryClient.setQueryData(detailKey, (order: typeof previousDetail) =>
    order ? { ...order, status } : order,
  );

  return { listKey, detailKey, previousList, previousDetail };
}

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
      onMutate: async ({ id }) => {
        await Promise.all([
          queryClient.cancelQueries(trpc.order.list.queryFilter()),
          queryClient.cancelQueries(trpc.order.byId.queryFilter({ id })),
        ]);
        return setOptimisticStatus(queryClient, trpc, id, "shipped");
      },
      onError: (_err, _vars, context) => {
        if (!context) return;
        queryClient.setQueryData(context.listKey, context.previousList);
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      },
      onSettled: async (order, _err, { id }) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(
            trpc.order.byId.queryFilter({ id }),
          ),
          order &&
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
      onMutate: async ({ id }) => {
        await Promise.all([
          queryClient.cancelQueries(trpc.order.list.queryFilter()),
          queryClient.cancelQueries(trpc.order.byId.queryFilter({ id })),
        ]);
        return setOptimisticStatus(queryClient, trpc, id, "cancelled");
      },
      onError: (_err, _vars, context) => {
        if (!context) return;
        queryClient.setQueryData(context.listKey, context.previousList);
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      },
      onSettled: async (order, _err, { id }) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(
            trpc.order.byId.queryFilter({ id }),
          ),
          order &&
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
