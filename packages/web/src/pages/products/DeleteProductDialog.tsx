import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Product } from "server/router";
import { readableError } from "../../lib/errors";
import { useTRPC } from "../../trpc";
import ConfirmDeleteDialog from "../../ui/ConfirmDeleteDialog";

export default function DeleteProductDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const removeProduct = useMutation(
    trpc.product.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.product.list.queryFilter());
        onClose();
      },
      // A product that appears in an order cannot be deleted; the server says
      // so and the dialog stays open with the reason.
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  return (
    <ConfirmDeleteDialog
      label="Delete product"
      title="Delete product?"
      confirmLabel="Delete product"
      pendingLabel="Deleting…"
      isPending={removeProduct.isPending}
      error={error}
      onConfirm={() => removeProduct.mutate({ id: product.id })}
      onClose={onClose}
    >
      This will permanently remove <strong>{product.name}</strong> from the
      catalog. This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
