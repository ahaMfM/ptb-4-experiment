import type { ChangeEvent } from "react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/** The product form as it is typed: every value a string, as inputs give them. */
export type ProductFormValues = {
  name: string;
  description: string;
  image: string; // base64 data URL, "" while none chosen
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

/** Normalize form values into the shape the server expects. */
export function toProductInput(form: ProductFormValues) {
  return {
    name: form.name,
    description: form.description,
    image: form.image,
    price: form.price.trim().replace(",", "."),
    stock: Number(form.stock),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** The input fields of a product, shared by adding and editing one. */
export default function ProductFormFields({
  form,
  onChange,
  onError,
  requireImage,
}: {
  form: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  onError: (message: string | null) => void;
  /** A new product needs a picture; an existing one already has one. */
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
