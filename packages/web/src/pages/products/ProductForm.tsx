import type { ChangeEvent } from "react";
import type { Product } from "server/router";

/**
 * The product form: what it holds while being filled in, how it is rendered,
 * and how its text turns into what the API expects.
 *
 * Callers keep the values in their own state (so they decide when to reset a
 * form or seed it from an existing product) and hand them straight back in.
 * The picture is the only field that is not plain text: it is read here and
 * kept as a base64 data URL, which is also how it is stored and shown.
 */

export type ProductFormValues = {
  name: string;
  description: string;
  /** Base64 data URL, "" while none chosen. */
  image: string;
  price: string;
  stock: string;
};

export const emptyProductForm: ProductFormValues = {
  name: "",
  description: "",
  image: "",
  price: "",
  stock: "",
};

/** Fill the form from an existing product, for editing. */
export function productFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.price,
    stock: String(product.stock),
  };
}

/**
 * Normalize form values into the shape the server expects: the price as a
 * decimal string with a dot, the stock as a number.
 */
export function toProductInput(form: ProductFormValues) {
  return {
    name: form.name,
    description: form.description,
    image: form.image,
    price: form.price.trim().replace(",", "."),
    stock: Number(form.stock),
  };
}

/** Kept in step with the server's own limit on the picture's size. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function ProductFields({
  form,
  onChange,
  /** Reports a picture that could not be used; null clears the report. */
  onError,
  /** Adding a product needs a picture; editing keeps the existing one. */
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
