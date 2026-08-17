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

export function useMarkShipped() {
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
