import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Product } from "server/router";
import Modal from "../components/Modal";
import { readableError } from "../lib/errors";
import { useTRPC } from "../trpc";
import ProductFormFields, {
  toProductInput,
  type ProductFormValues,
} from "./ProductFormFields";

export default function EditProductDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormValues>({
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.price,
    stock: String(product.stock),
  });
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
    <Modal ariaLabel="Edit product" onClose={onClose}>
      <h2>Edit product</h2>
      <form onSubmit={handleSubmit}>
        <ProductFormFields
          form={form}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onError={setError}
          requireImage={false}
        />
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" disabled={updateProduct.isPending}>
            {updateProduct.isPending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
