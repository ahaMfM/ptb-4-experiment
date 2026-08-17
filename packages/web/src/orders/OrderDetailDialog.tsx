import { useQuery } from "@tanstack/react-query";
import Modal from "../components/Modal";
import QueryFeedback from "../components/QueryFeedback";
import StatusBadge from "../components/StatusBadge";
import { readableError } from "../lib/errors";
import { formatDate, formatDateTime, formatPrice } from "../lib/format";
import { useTRPC } from "../trpc";
import {
  cancellationMessage,
  confirmOrderCancellation,
  shipmentMessage,
  useCancelOrder,
  useShipOrder,
} from "./orderActions";

/** One order in full: who ordered, what, and what may still be done to it. */
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

  const shipOrder = useShipOrder();
  const cancelOrder = useCancelOrder();
  const busy = shipOrder.isPending || cancelOrder.isPending;

  return (
    <Modal ariaLabel={`Order #${orderId}`} wide onClose={onClose}>
      <header className="order-header">
        <h2>Order #{orderId}</h2>
        {order && <StatusBadge status={order.status} />}
      </header>

      <QueryFeedback query={detailQuery} errorPrefix="Could not load order" />

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
              <a href={`mailto:${order.customer.email}`}>
                {order.customer.email}
              </a>
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

      {shipOrder.isError && (
        <p className="error">{readableError(shipOrder.error.message)}</p>
      )}
      {shipOrder.isSuccess && (
        <p className="success">{shipmentMessage(shipOrder.data)}</p>
      )}
      {cancelOrder.isError && (
        <p className="error">{readableError(cancelOrder.error.message)}</p>
      )}
      {cancelOrder.isSuccess && (
        <p className="success">{cancellationMessage(cancelOrder.data)}</p>
      )}

      <div className="actions">
        {order?.status === "open" && (
          <>
            <button
              type="button"
              onClick={() => shipOrder.mutate({ id: orderId })}
              disabled={busy}
            >
              {shipOrder.isPending ? "Marking as shipped…" : "Mark as shipped"}
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (confirmOrderCancellation(orderId)) {
                  cancelOrder.mutate({ id: orderId });
                }
              }}
              disabled={busy}
            >
              {cancelOrder.isPending ? "Cancelling…" : "Cancel order"}
            </button>
          </>
        )}
        <button type="button" className="secondary" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </Modal>
  );
}
