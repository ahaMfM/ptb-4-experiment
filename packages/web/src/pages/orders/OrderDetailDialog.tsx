import { useQuery } from "@tanstack/react-query";
import { readableError } from "../../lib/errors";
import { formatDate, formatDateTime, formatPrice } from "../../lib/format";
import { useTRPC } from "../../trpc";
import Modal from "../../ui/Modal";
import StatusBadge from "../../ui/StatusBadge";
import { useCancelOrder, useMarkShipped } from "./orderActions";

/**
 * One order in full: who it is for, what is on it, and — while it is still
 * open — the two things that can happen to it next.
 */
export default function OrderDetailDialog({
  orderId,
  onClose,
}: {
  orderId: number;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const detailQuery = useQuery(trpc.order.byId.queryOptions({ id: orderId }));
  const order = detailQuery.data;

  const markShipped = useMarkShipped();
  const cancelOrder = useCancelOrder();

  return (
    <Modal label={`Order #${orderId}`} wide onClose={onClose}>
      <header className="order-header">
        <h2>Order #{orderId}</h2>
        {order && <StatusBadge status={order.status} />}
      </header>

      {detailQuery.isLoading && <p className="muted">Loading…</p>}
      {detailQuery.isError && (
        <p className="error">
          Could not load order: {readableError(detailQuery.error.message)}
        </p>
      )}

      {order && (
        <>
          <p className="muted">
            Placed on {formatDateTime(order.createdAt)}
            {/* Who recorded the order — unknown for old entries. */}
            {order.recordedBy && <> · recorded by {order.recordedBy}</>}
          </p>

          <h3>Customer</h3>
          <div className="detail-grid">
            <div>
              <span className="detail-label">Company</span>
              {order.customer.company}
            </div>
            <div>
              <span className="detail-label">First name</span>
              {order.customer.firstName}
            </div>
            <div>
              <span className="detail-label">Family name</span>
              {order.customer.familyName}
            </div>
            <div>
              <span className="detail-label">E-mail</span>
              <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>
            </div>
            <div>
              <span className="detail-label">Customer since</span>
              {formatDate(order.customer.customerSince)}
            </div>
            <div>
              <span className="detail-label">Address</span>
              <span className="address">{order.customer.address}</span>
            </div>
          </div>

          <h3>Items</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Quantity</th>
                  <th className="num">Unit price</th>
                  <th className="num">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.productId}>
                    <td>{item.productName}</td>
                    <td className="num">{item.quantity}</td>
                    <td className="num">{formatPrice(item.unitPrice)}</td>
                    <td className="num">
                      {formatPrice(Number(item.unitPrice) * item.quantity)}
                    </td>
                  </tr>
                ))}
                <tr className="order-total-row">
                  <td colSpan={3}>Total</td>
                  <td className="num">{formatPrice(order.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {markShipped.isError && (
        <p className="error">{readableError(markShipped.error.message)}</p>
      )}
      {markShipped.isSuccess && (
        <p className="success">
          Order #{orderId} was shipped. Invoice #{markShipped.data.invoiceId} over{" "}
          {formatPrice(markShipped.data.invoiceAmount)} was issued.
        </p>
      )}
      {cancelOrder.isError && (
        <p className="error">{readableError(cancelOrder.error.message)}</p>
      )}
      {cancelOrder.isSuccess && (
        <p className="success">
          Order #{orderId} was cancelled. The products are back on stock.
        </p>
      )}

      <div className="actions">
        {order?.status === "open" && (
          <button
            type="button"
            onClick={() => markShipped.mutate({ id: orderId })}
            disabled={markShipped.isPending || cancelOrder.isPending}
          >
            {markShipped.isPending ? "Marking as shipped…" : "Mark as shipped"}
          </button>
        )}
        {order?.status === "open" && (
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (
                window.confirm(
                  `Cancel order #${orderId}? The ordered products go back on stock.`,
                )
              ) {
                cancelOrder.mutate({ id: orderId });
              }
            }}
            disabled={cancelOrder.isPending || markShipped.isPending}
          >
            {cancelOrder.isPending ? "Cancelling…" : "Cancel order"}
          </button>
        )}
        <button type="button" className="secondary" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </Modal>
  );
}
