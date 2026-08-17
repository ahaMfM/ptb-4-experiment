import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readableError } from "../../lib/errors";
import { useTRPC } from "../../trpc";

/**
 * Placing, shipping and cancelling an order.
 *
 * Each of these changes more than the order itself, and what else goes stale
 * is stated here once instead of next to every button that triggers it:
 *  - placing an order takes the goods off stock → the product list;
 *  - shipping issues the order's invoice → every invoice query, including the
 *    unpaid count shown on the start screen;
 *  - cancelling puts the ordered quantities back on stock → the product list.
 *
 * The returned mutation is an ordinary react-query mutation, so callers show
 * pending state, errors and success messages in their own words.
 */

export function usePlaceOrder({
  onPlaced,
  onFailed,
}: {
  onPlaced: (order: { id: number; status: string }) => void;
  /** Already made readable; show it as it is. */
  onFailed: (message: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.order.create.mutationOptions({
      onSuccess: async (order) => {
        onPlaced(order);
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(trpc.product.list.queryFilter()),
        ]);
      },
      onError: (err) => onFailed(readableError(err.message)),
    }),
  );
}

/**
 * Set an order's status in both places it is cached — the list row and the
 * detail view — and hand back a snapshot of what they held before, so a
 * failed mutation can put them back exactly as they were.
 */
function setCachedStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  trpc: ReturnType<typeof useTRPC>,
  id: number,
  status: "shipped" | "cancelled",
) {
  const listKey = trpc.order.list.queryKey();
  const detailKey = trpc.order.byId.queryKey({ id });

  const previousList = queryClient.getQueryData(listKey);
  const previousDetail = queryClient.getQueryData(detailKey);

  queryClient.setQueryData(listKey, (orders) =>
    orders?.map((order) => (order.id === id ? { ...order, status } : order)),
  );
  queryClient.setQueryData(detailKey, (order) =>
    order ? { ...order, status } : order,
  );

  return { listKey, detailKey, previousList, previousDetail };
}

export function useMarkShipped() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.order.markShipped.mutationOptions({
      onMutate: async ({ id }) => {
        await Promise.all([
          queryClient.cancelQueries(trpc.order.list.queryFilter()),
          queryClient.cancelQueries(trpc.order.byId.queryFilter({ id })),
        ]);
        return setCachedStatus(queryClient, trpc, id, "shipped");
      },
      onError: (_err, _vars, context) => {
        if (!context) return;
        queryClient.setQueryData(context.listKey, context.previousList);
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      },
      onSettled: async (order, _err, { id }) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(trpc.order.byId.queryFilter({ id })),
          order && queryClient.invalidateQueries(trpc.invoice.pathFilter()),
        ]);
      },
    }),
  );
}

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
        return setCachedStatus(queryClient, trpc, id, "cancelled");
      },
      onError: (_err, _vars, context) => {
        if (!context) return;
        queryClient.setQueryData(context.listKey, context.previousList);
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      },
      onSettled: async (order, _err, { id }) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(trpc.order.byId.queryFilter({ id })),
          order && queryClient.invalidateQueries(trpc.product.list.queryFilter()),
        ]);
      },
    }),
  );
}
