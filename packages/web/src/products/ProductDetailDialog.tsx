import { useQuery } from "@tanstack/react-query";
import Modal from "../components/Modal";
import QueryFeedback from "../components/QueryFeedback";
import { formatPrice } from "../lib/format";
import { useTRPC } from "../trpc";

/** What a product actually is and costs today, looked up live by id. */
export default function ProductDetailDialog({
  productId,
  onClose,
}: {
  productId: number;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const productQuery = useQuery(
    trpc.product.byId.queryOptions({ id: productId }),
  );
  const product = productQuery.data;

  return (
    <Modal ariaLabel="Product details" onClose={onClose}>
      <QueryFeedback query={productQuery} errorPrefix="Could not load product" />
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
