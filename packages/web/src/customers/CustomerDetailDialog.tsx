import { useQuery } from "@tanstack/react-query";
import type { CustomerRecord } from "server/router";
import Modal from "../components/Modal";
import QueryFeedback from "../components/QueryFeedback";
import StatusBadge from "../components/StatusBadge";
import {
  formatDate,
  formatDateTime,
  formatOrderContents,
  formatPrice,
} from "../lib/format";
import { useTRPC } from "../trpc";

/**
 * Everything about one customer at a glance: contact details plus every
 * order they have placed and whether it is open, shipped or cancelled.
 */
export default function CustomerDetailDialog({
  customer,
  onClose,
}: {
  customer: CustomerRecord;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const ordersQuery = useQuery(
    trpc.customer.orders.queryOptions({ customerId: customer.id }),
  );
  const orders = ordersQuery.data ?? [];

  return (
    <Modal
      ariaLabel={`Customer ${customer.firstName} ${customer.familyName}`}
      wide
      onClose={onClose}
    >
      <header className="order-header">
        <h2>{customer.company}</h2>
        <span className="muted">Customer #{customer.id}</span>
      </header>

      <div className="detail-grid">
        <div>
          <span className="detail-label">First name</span>
          {customer.firstName}
        </div>
        <div>
          <span className="detail-label">Family name</span>
          {customer.familyName}
        </div>
        <div>
          <span className="detail-label">E-mail</span>
          <a href={`mailto:${customer.email}`}>{customer.email}</a>
        </div>
        <div>
          <span className="detail-label">Customer since</span>
          {formatDate(customer.customerSince)}
        </div>
        <div>
          <span className="detail-label">Address</span>
          <span className="address">{customer.address}</span>
        </div>
        <div>
          <span className="detail-label">Recorded by</span>
          {customer.recordedBy ? (
            <>
              {customer.recordedBy}
              {customer.createdAt && (
                <span className="muted">
                  {" "}
                  on {formatDateTime(customer.createdAt)}
                </span>
              )}
            </>
          ) : (
            // Entries from before everyone signed in: we do not know.
            <span className="muted">—</span>
          )}
        </div>
      </div>

      <h3>
        Orders
        {ordersQuery.isSuccess && (
          <span className="count"> ({orders.length})</span>
        )}
      </h3>
      <QueryFeedback query={ordersQuery} errorPrefix="Could not load orders" />
      {ordersQuery.isSuccess && orders.length === 0 && (
        <p className="muted">This customer has not placed any orders yet.</p>
      )}
      {orders.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Recorded by</th>
                <th>Contents</th>
                <th>Status</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{formatDateTime(order.createdAt)}</td>
                  <td>{order.recordedBy ?? <span className="muted">—</span>}</td>
                  <td>{formatOrderContents(order.items)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="num">{formatPrice(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="actions">
        <button type="button" className="secondary" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </Modal>
  );
}
