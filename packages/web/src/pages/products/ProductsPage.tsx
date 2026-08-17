import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Product } from "server/router";
import { readableError } from "../../lib/errors";
import { formatPrice } from "../../lib/format";
import { useTRPC } from "../../trpc";
import DeleteProductDialog from "./DeleteProductDialog";
import EditProductDialog from "./EditProductDialog";
import {
  emptyProductForm,
  ProductFields,
  toProductInput,
} from "./ProductForm";

type ViewMode = "grid" | "compact";

const VIEW_MODE_KEY = "products.viewMode";

function loadViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_KEY);
  return stored === "compact" ? "compact" : "grid";
}

/** The catalog: what is on offer, at what price, and how much of it is left. */
export default function ProductsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyProductForm);
  // A file input's value cannot be set from code, so the fields are remounted
  // under a new key to clear the chosen picture after a product was added.
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);

  const toggleViewMode = () => {
    const next = viewMode === "grid" ? "compact" : "grid";
    setViewMode(next);
    localStorage.setItem(VIEW_MODE_KEY, next);
  };

  const productsQuery = useQuery(trpc.product.list.queryOptions());

  const createProduct = useMutation(
    trpc.product.create.mutationOptions({
      onSuccess: async () => {
        setForm(emptyProductForm);
        setFormKey((k) => k + 1);
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

  const products = productsQuery.data ?? [];

  return (
    <>
      <h1>Products</h1>

      <section className="card">
        <h2>Add a product</h2>
        <form onSubmit={handleSubmit}>
          <ProductFields
            key={formKey}
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
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
        <div className="section-header">
          <h2>
            Our products
            {productsQuery.isSuccess && <span className="count"> ({products.length})</span>}
          </h2>
          <button type="button" className="link-button" onClick={toggleViewMode}>
            {viewMode === "grid" ? "Switch to compact view" : "Switch to full view"}
          </button>
        </div>
        {productsQuery.isLoading && <p className="muted">Loading…</p>}
        {productsQuery.isError && (
          <p className="error">Could not load products: {productsQuery.error.message}</p>
        )}
        {productsQuery.isSuccess && products.length === 0 && (
          <p className="muted">No products yet. Add your first one above.</p>
        )}
        {products.length > 0 && viewMode === "grid" && (
          <div className="product-grid">
            {products.map((p) => (
              <article key={p.id} className="product-card">
                <img className="product-image" src={p.image} alt={p.name} />
                <div className="product-body">
                  <div className="product-title">
                    <h3>{p.name}</h3>
                    <span className="product-price">{formatPrice(p.price)}</span>
                  </div>
                  <p className="product-description">{p.description}</p>
                  <div className="product-footer">
                    <span
                      className={
                        p.stock > 0 ? "stock-badge" : "stock-badge out-of-stock"
                      }
                    >
                      {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                    </span>
                    <span className="row-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setEditing(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-button danger-link"
                        onClick={() => setDeleting(p)}
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
        {products.length > 0 && viewMode === "compact" && (
          <div className="product-grid product-grid-compact">
            {products.map((p) => (
              <article
                key={p.id}
                className="product-card product-card-compact"
                onClick={() => setEditing(p)}
              >
                <img className="product-image-compact" src={p.image} alt={p.name} />
                <div className="product-body-compact">
                  <span className="product-name-compact">{p.name}</span>
                  <span className="product-price">{formatPrice(p.price)}</span>
                  <span
                    className={
                      p.stock > 0 ? "stock-badge" : "stock-badge out-of-stock"
                    }
                  >
                    {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                  </span>
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
