import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { Product } from "server/router";
import { useTRPC } from "./trpc";
import { readableError } from "./utils";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

type ProductFormValues = {
  name: string;
  description: string;
  image: string; // base64 data URL, "" while none chosen
  price: string;
  stock: string;
};

const emptyForm: ProductFormValues = {
  name: "",
  description: "",
  image: "",
  price: "",
  stock: "",
};

const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

function formatPrice(price: string): string {
  const value = Number(price);
  return Number.isFinite(value) ? priceFormatter.format(value) : price;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Normalize form values into the shape the server expects. */
function toInput(form: ProductFormValues) {
  return {
    name: form.name,
    description: form.description,
    image: form.image,
    price: form.price.trim().replace(",", "."),
    stock: Number(form.stock),
  };
}

function ProductFields({
  form,
  onChange,
  onError,
  requireImage,
}: {
  form: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  onError: (message: string | null) => void;
  requireImage: boolean;
}) {
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      onError("Picture must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange({ image: dataUrl });
      onError(null);
    } catch {
      onError("Could not read the selected picture.");
    }
  };

  return (
    <div className="grid">
      <label>
        Product name
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Espresso beans 1 kg"
          required
        />
      </label>
      <label>
        Price (EUR)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={form.price}
          onChange={(e) => onChange({ price: e.target.value })}
          placeholder="19.90"
          required
        />
      </label>
      <label>
        In stock
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={form.stock}
          onChange={(e) => onChange({ stock: e.target.value })}
          placeholder="25"
          required
        />
      </label>
      <label>
        Picture
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
          onChange={handleFile}
          required={requireImage && !form.image}
        />
      </label>
      <label className="full">
        Description
        <textarea
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Freshly roasted arabica beans from Colombia."
          rows={3}
          required
        />
      </label>
      {form.image && (
        <div className="full image-preview">
          <img src={form.image} alt="Product picture preview" />
        </div>
      )}
    </div>
  );
}

function DeleteProductDialog({
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
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal card"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete product"
      >
        <h2>Delete product?</h2>
        <p>
          This will permanently remove <strong>{product.name}</strong> from the
          catalog. This cannot be undone.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button
            type="button"
            className="danger"
            onClick={() => removeProduct.mutate({ id: product.id })}
            disabled={removeProduct.isPending}
          >
            {removeProduct.isPending ? "Deleting…" : "Delete product"}
          </button>
          <button type="button" className="secondary" onClick={onClose} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProductDialog({
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
    updateProduct.mutate({ id: product.id, ...toInput(form) });
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal card" role="dialog" aria-modal="true" aria-label="Edit product">
        <h2>Edit product</h2>
        <form onSubmit={handleSubmit}>
          <ProductFields
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
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
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [formKey, setFormKey] = useState(0); // remount to clear the file input
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const productsQuery = useQuery(trpc.product.list.queryOptions());

  const createProduct = useMutation(
    trpc.product.create.mutationOptions({
      onSuccess: async () => {
        setForm(emptyForm);
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
    createProduct.mutate(toInput(form));
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
        <h2>
          Our products
          {productsQuery.isSuccess && <span className="count"> ({products.length})</span>}
        </h2>
        {productsQuery.isLoading && <p className="muted">Loading…</p>}
        {productsQuery.isError && (
          <p className="error">Could not load products: {productsQuery.error.message}</p>
        )}
        {productsQuery.isSuccess && products.length === 0 && (
          <p className="muted">No products yet. Add your first one above.</p>
        )}
        {products.length > 0 && (
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
