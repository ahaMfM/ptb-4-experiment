import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCanWrite } from "../auth/CurrentUserContext";
import QueryFeedback from "../components/QueryFeedback";
import StatusBadge from "../components/StatusBadge";
import { readableError } from "../lib/errors";
import {
  formatDateTime,
  formatOrderContents,
  formatPrice,
} from "../lib/format";
import { useTRPC } from "../trpc";
import OrderDetailDialog from "./OrderDetailDialog";
import {
  cancellationMessage,
  confirmOrderCancellation,
  shipmentMessage,
  useCancelOrder,
  useShipOrder,
} from "./orderActions";
import PlaceOrderForm from "./PlaceOrderForm";

/** What has been ordered: place new orders, ship or cancel the open ones. */
export default function OrdersPage() {
  const trpc = useTRPC();
  const canWrite = useCanWrite();
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const ordersQuery = useQuery(trpc.order.list.queryOptions());
  const orders = ordersQuery.data ?? [];

  const shipOrder = useShipOrder();
  const cancelOrder = useCancelOrder();
  const busy = shipOrder.isPending || cancelOrder.isPending;

  return (
    <>
      <h1>Orders</h1>

      {canWrite && <PlaceOrderForm />}

      <section className="card">
        <h2>
          All orders
          {ordersQuery.isSuccess && (
            <span className="count"> ({orders.length})</span>
          )}
        </h2>
        <QueryFeedback query={ordersQuery} errorPrefix="Could not load orders" />
        {ordersQuery.isSuccess && orders.length === 0 && (
          <p className="muted">No orders yet. Place your first one above.</p>
        )}
        {shipOrder.isError && (
          <p className="error">
            Could not mark the order as shipped:{" "}
            {readableError(shipOrder.error.message)}
          </p>
        )}
        {shipOrder.isSuccess && (
          <p className="success">{shipmentMessage(shipOrder.data)}</p>
        )}
        {cancelOrder.isError && (
          <p className="error">
            Could not cancel the order: {readableError(cancelOrder.error.message)}
          </p>
        )}
        {cancelOrder.isSuccess && (
          <p className="success">{cancellationMessage(cancelOrder.data)}</p>
        )}
        {orders.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Placed</th>
                  <th>Recorded by</th>
                  <th>Contents</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="clickable"
                    onClick={() => setOpenOrderId(order.id)}
                  >
                    <td>#{order.id}</td>
                    <td>
                      {order.company}
                      <br />
                      <span className="muted">{order.contactName}</span>
                    </td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>
                      {/* Unknown for orders from before everyone signed in. */}
                      {order.recordedBy ?? <span className="muted">—</span>}
                    </td>
                    <td>{formatOrderContents(order.items)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="num">{formatPrice(order.total)}</td>
                    <td>
                      <span className="row-actions">
                        {canWrite && order.status === "open" && (
                          <>
                            <button
                              type="button"
                              className="link-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                shipOrder.mutate({ id: order.id });
                              }}
                              disabled={busy}
                            >
                              Mark as shipped
                            </button>
                            <button
                              type="button"
                              className="link-button danger-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirmOrderCancellation(order.id)) {
                                  cancelOrder.mutate({ id: order.id });
                                }
                              }}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="link-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenOrderId(order.id);
                          }}
                        >
                          Details
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openOrderId !== null && (
        <OrderDetailDialog
          key={openOrderId}
          orderId={openOrderId}
          onClose={() => setOpenOrderId(null)}
        />
      )}
    </>
  );
}
