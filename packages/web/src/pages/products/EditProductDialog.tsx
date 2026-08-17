import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Product } from "server/router";
import { readableError } from "../../lib/errors";
import { useTRPC } from "../../trpc";
import EditDialog from "../../ui/EditDialog";
import {
  ProductFields,
  productFormValues,
  toProductInput,
  type ProductFormValues,
} from "./ProductForm";

export default function EditProductDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormValues>(productFormValues(product));
  const [error, setError] = useState<string | null>(null);

  const updateProduct = useMutation(
    trpc.product.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.product.list.queryFilter());
        onClose();
      },
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateProduct.mutate({ id: product.id, ...toProductInput(form) });
  };

  return (
    <EditDialog
      label="Edit product"
      title="Edit product"
      isPending={updateProduct.isPending}
      error={error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <ProductFields
        form={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onError={setError}
        requireImage={false}
      />
    </EditDialog>
  );
}
