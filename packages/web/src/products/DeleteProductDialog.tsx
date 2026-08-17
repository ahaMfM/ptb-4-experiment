import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Product } from "server/router";
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import { readableError } from "../lib/errors";
import { useTRPC } from "../trpc";

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
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  return (
    <ConfirmDeleteDialog
      ariaLabel="Delete product"
      heading="Delete product?"
      confirmLabel="Delete product"
      pending={removeProduct.isPending}
      error={error}
      onConfirm={() => removeProduct.mutate({ id: product.id })}
      onClose={onClose}
    >
      This will permanently remove <strong>{product.name}</strong> from the
      catalog. This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
