import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Product } from "server/router";
import QueryFeedback from "../components/QueryFeedback";
import { readableError } from "../lib/errors";
import { formatPrice } from "../lib/format";
import { useTRPC } from "../trpc";
import DeleteProductDialog from "./DeleteProductDialog";
import EditProductDialog from "./EditProductDialog";
import ProductFormFields, {
  emptyProductForm,
  toProductInput,
} from "./ProductFormFields";

/** The catalog: what we sell, at what price, and how much of it is in stock. */
export default function ProductsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyProductForm);
  const [formKey, setFormKey] = useState(0); // remount to clear the file input
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const productsQuery = useQuery(trpc.product.list.queryOptions());
  const products = productsQuery.data ?? [];

  const createProduct = useMutation(
    trpc.product.create.mutationOptions({
      onSuccess: async () => {
        setForm(emptyProductForm);
        setFormKey((key) => key + 1);
        setError(null);
        await queryClient.invalidateQueries(trpc.product.list.queryFilter());
      },
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.image) {
      setError("Please choose a product picture.");
      return;
    }
    createProduct.mutate(toProductInput(form));
  };

  return (
    <>
      <h1>Products</h1>

      <section className="card">
        <h2>Add a product</h2>
        <form onSubmit={handleSubmit}>
          <ProductFormFields
            key={formKey}
            form={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            onError={setError}
            requireImage
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={createProduct.isPending}>
            {createProduct.isPending ? "Adding…" : "Add product"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>
          Our products
          {productsQuery.isSuccess && (
            <span className="count"> ({products.length})</span>
          )}
        </h2>
        <QueryFeedback query={productsQuery} errorPrefix="Could not load products" />
        {productsQuery.isSuccess && products.length === 0 && (
          <p className="muted">No products yet. Add your first one above.</p>
        )}
        {products.length > 0 && (
          <div className="product-grid">
            {products.map((product) => (
              <article key={product.id} className="product-card">
                <img
                  className="product-image"
                  src={product.image}
                  alt={product.name}
                />
                <div className="product-body">
                  <div className="product-title">
                    <h3>{product.name}</h3>
                    <span className="product-price">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                  <p className="product-description">{product.description}</p>
                  <div className="product-footer">
                    <span
                      className={
                        product.stock > 0
                          ? "stock-badge"
                          : "stock-badge out-of-stock"
                      }
                    >
                      {product.stock > 0
                        ? `${product.stock} in stock`
                        : "Out of stock"}
                    </span>
                    <span className="row-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setEditing(product)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-button danger-link"
                        onClick={() => setDeleting(product)}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <EditProductDialog
          key={editing.id}
          product={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <DeleteProductDialog
          key={deleting.id}
          product={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
