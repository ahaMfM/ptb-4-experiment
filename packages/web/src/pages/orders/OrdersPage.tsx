import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { readableError } from "../../lib/errors";
import { formatDateTime, formatPrice } from "../../lib/format";
import { useSearchParam } from "../../lib/urlState";
import { useTRPC } from "../../trpc";
import StatusBadge from "../../ui/StatusBadge";
import { useCancelOrder, useMarkShipped } from "./orderActions";
import OrderDetailDialog from "./OrderDetailDialog";
import PlaceOrderForm from "./PlaceOrderForm";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "shipped", label: "Shipped" },
  { id: "cancelled", label: "Cancelled" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

/** Orders: place a new one, and work through the ones already on record. */
export default function OrdersPage() {
  const trpc = useTRPC();
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useSearchParam<StatusFilter>("status", "all");

  const ordersQuery = useQuery(trpc.order.list.queryOptions());
  const allOrders = ordersQuery.data ?? [];
  const orders =
    statusFilter === "all"
      ? allOrders
      : allOrders.filter((order) => order.status === statusFilter);

  const markShipped = useMarkShipped();
  const cancelOrder = useCancelOrder();

  return (
    <>
      <h1>Orders</h1>

      <PlaceOrderForm />

      <section className="card">
        <h2>
          {STATUS_FILTERS.find((f) => f.id === statusFilter)!.label} orders
          {ordersQuery.isSuccess && <span className="count"> ({orders.length})</span>}
        </h2>

        <nav className="tabs subtabs" aria-label="Filter orders by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={statusFilter === filter.id ? "tab active" : "tab"}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </nav>

        {ordersQuery.isLoading && <p className="muted">Loading…</p>}
        {ordersQuery.isError && (
          <p className="error">Could not load orders: {ordersQuery.error.message}</p>
        )}
        {ordersQuery.isSuccess && allOrders.length === 0 && (
          <p className="muted">No orders yet. Place your first one above.</p>
        )}
        {ordersQuery.isSuccess && allOrders.length > 0 && orders.length === 0 && (
          <p className="muted">No {statusFilter} orders.</p>
        )}
        {markShipped.isError && (
          <p className="error">
            Could not mark the order as shipped:{" "}
            {readableError(markShipped.error.message)}
          </p>
        )}
        {markShipped.isSuccess && (
          <p className="success">
            Order #{markShipped.data.id} was shipped. Invoice #
            {markShipped.data.invoiceId} over{" "}
            {formatPrice(markShipped.data.invoiceAmount)} was issued.
          </p>
        )}
        {cancelOrder.isError && (
          <p className="error">
            Could not cancel the order: {readableError(cancelOrder.error.message)}
          </p>
        )}
        {cancelOrder.isSuccess && (
          <p className="success">
            Order #{cancelOrder.data.id} was cancelled. The products are back on
            stock.
          </p>
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
                    <td>
                      {order.items
                        .map((item) => `${item.quantity} × ${item.productName}`)
                        .join(", ")}
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="num">{formatPrice(order.total)}</td>
                    <td>
                      <span className="row-actions">
                        {order.status === "open" && (
                          <button
                            type="button"
                            className="link-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markShipped.mutate({ id: order.id });
                            }}
                            disabled={markShipped.isPending || cancelOrder.isPending}
                          >
                            Mark as shipped
                          </button>
                        )}
                        {order.status === "open" && (
                          <button
                            type="button"
                            className="link-button danger-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `Cancel order #${order.id}? The ordered products go back on stock.`,
                                )
                              ) {
                                cancelOrder.mutate({ id: order.id });
                              }
                            }}
                            disabled={cancelOrder.isPending || markShipped.isPending}
                          >
                            Cancel
                          </button>
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
