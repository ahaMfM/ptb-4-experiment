import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import QueryFeedback from "../components/QueryFeedback";
import StatusBadge from "../components/StatusBadge";
import { readableError } from "../lib/errors";
import {
  formatDateTime,
  formatOrderContents,
  formatPrice,
} from "../lib/format";
import { getSearchParam, setSearchParam } from "../lib/url";
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

/** The statuses orders can be narrowed down to, "all" meaning no filter. */
const STATUS_FILTERS = ["all", "open", "shipped", "cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  open: "Open",
  shipped: "Shipped",
  cancelled: "Cancelled",
};

/** The filter to show on load: whatever the URL names, else "all". */
function initialStatusFilter(): StatusFilter {
  const status = getSearchParam("status");
  return (STATUS_FILTERS as readonly string[]).includes(status ?? "")
    ? (status as StatusFilter)
    : "all";
}

/** What has been ordered: place new orders, ship or cancel the open ones. */
export default function OrdersPage() {
  const trpc = useTRPC();
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [statusFilter, setStatusFilterState] =
    useState<StatusFilter>(initialStatusFilter);

  function setStatusFilter(next: StatusFilter) {
    setStatusFilterState(next);
    setSearchParam("status", next === "all" ? null : next);
  }

  const ordersQuery = useQuery(trpc.order.list.queryOptions());
  const allOrders = ordersQuery.data ?? [];
  const orders =
    statusFilter === "all"
      ? allOrders
      : allOrders.filter((order) => order.status === statusFilter);

  const shipOrder = useShipOrder();
  const cancelOrder = useCancelOrder();
  const busy = shipOrder.isPending || cancelOrder.isPending;

  return (
    <>
      <h1>Orders</h1>

      <PlaceOrderForm />

      <section className="card">
        <div className="invoice-toolbar">
          <h2>
            {STATUS_FILTER_LABELS[statusFilter]} orders
            {ordersQuery.isSuccess && (
              <span className="count"> ({orders.length})</span>
            )}
          </h2>
          <div className="status-filter" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={
                  filter === statusFilter ? "chip active" : "chip"
                }
                aria-pressed={filter === statusFilter}
                onClick={() => setStatusFilter(filter)}
              >
                {STATUS_FILTER_LABELS[filter]}
              </button>
            ))}
          </div>
        </div>
        <QueryFeedback query={ordersQuery} errorPrefix="Could not load orders" />
        {ordersQuery.isSuccess && allOrders.length === 0 && (
          <p className="muted">No orders yet. Place your first one above.</p>
        )}
        {ordersQuery.isSuccess && allOrders.length > 0 && orders.length === 0 && (
          <p className="muted">
            No {STATUS_FILTER_LABELS[statusFilter].toLowerCase()} orders.
          </p>
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
                        {order.status === "open" && (
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
