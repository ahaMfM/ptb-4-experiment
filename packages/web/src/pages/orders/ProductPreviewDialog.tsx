import { useQuery } from "@tanstack/react-query";
import { readableError } from "../../lib/errors";
import { formatPrice } from "../../lib/format";
import { useTRPC } from "../../trpc";
import Modal from "../../ui/Modal";

/**
 * What a product looks like and costs right now, for a clerk who needs to
 * answer a customer's question without losing their place in the order.
 * Prices and pictures change after an order is placed, so this always shows
 * the catalog's current data, not what was billed at order time.
 */
export default function ProductPreviewDialog({
  productId,
  productName,
  onClose,
}: {
  productId: number;
  productName: string;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const productsQuery = useQuery(trpc.product.list.queryOptions());
  const product = productsQuery.data?.find((p) => p.id === productId);

  return (
    <Modal label={productName} onClose={onClose}>
      <h2>{productName}</h2>

      {productsQuery.isLoading && <p className="muted">Loading…</p>}
      {productsQuery.isError && (
        <p className="error">
          Could not load product: {readableError(productsQuery.error.message)}
        </p>
      )}
      {productsQuery.isSuccess && !product && (
        <p className="muted">This product is no longer in the catalog.</p>
      )}

      {product && (
        <article className="product-card">
          <img className="product-image" src={product.image} alt={product.name} />
          <div className="product-body">
            <div className="product-title">
              <h3>{product.name}</h3>
              <span className="product-price">{formatPrice(product.price)}</span>
            </div>
            <p className="product-description">{product.description}</p>
          </div>
        </article>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </Modal>
  );
}
