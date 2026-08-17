import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import StatusBadge from "./StatusBadge";
import { useTRPC } from "./trpc";
import { formatDate, formatDateTime, formatPrice, readableError } from "./utils";

type OrderLine = {
  productId: string; // "" while none chosen
  quantity: string;
};

const emptyLine: OrderLine = { productId: "", quantity: "1" };

function OrderDetailDialog({
  orderId,
  onClose,
}: {
  orderId: number;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const detailQuery = useQuery(trpc.order.byId.queryOptions({ id: orderId }));
  const order = detailQuery.data;

  const markShipped = useMutation(
    trpc.order.markShipped.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.byId.queryFilter({ id: orderId })),
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          // Shipping issues the invoice for the order, which also
          // changes the unpaid-invoice count on the start screen.
          queryClient.invalidateQueries(trpc.invoice.pathFilter()),
        ]);
      },
    }),
  );

  const cancelOrder = useMutation(
    trpc.order.cancel.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.byId.queryFilter({ id: orderId })),
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          // Cancelling puts the ordered quantities back on stock.
          queryClient.invalidateQueries(trpc.product.list.queryFilter()),
        ]);
      },
    }),
  );

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal modal-wide card"
        role="dialog"
        aria-modal="true"
        aria-label={`Order #${orderId}`}
      >
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
                <span className="detail-label">Contact person</span>
                {order.customer.contactName}
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
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  const customersQuery = useQuery(trpc.customer.list.queryOptions());
  const productsQuery = useQuery(trpc.product.list.queryOptions());
  const ordersQuery = useQuery(trpc.order.list.queryOptions());

  const customers = customersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];

  const productById = new Map(products.map((p) => [String(p.id), p]));

  const createOrder = useMutation(
    trpc.order.create.mutationOptions({
      onSuccess: async (order) => {
        setCustomerId("");
        setLines([{ ...emptyLine }]);
        setError(null);
        setSuccess(
          `Order #${order.id} was placed and is now ${order.status}. Stock has been updated.`,
        );
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(trpc.product.list.queryFilter()),
        ]);
      },
      onError: (err) => {
        setSuccess(null);
        setError(readableError(err.message));
      },
    }),
  );

  const markShipped = useMutation(
    trpc.order.markShipped.mutationOptions({
      onSuccess: async (order) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(
            trpc.order.byId.queryFilter({ id: order.id }),
          ),
          // Shipping issues the invoice for the order, which also
          // changes the unpaid-invoice count on the start screen.
          queryClient.invalidateQueries(trpc.invoice.pathFilter()),
        ]);
      },
    }),
  );

  const cancelOrder = useMutation(
    trpc.order.cancel.mutationOptions({
      onSuccess: async (order) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.order.list.queryFilter()),
          queryClient.invalidateQueries(
            trpc.order.byId.queryFilter({ id: order.id }),
          ),
          // Cancelling puts the ordered quantities back on stock.
          queryClient.invalidateQueries(trpc.product.list.queryFilter()),
        ]);
      },
    }),
  );

  const setLine = (index: number, patch: Partial<OrderLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const total = lines.reduce((sum, line) => {
    const product = productById.get(line.productId);
    const quantity = Number(line.quantity);
    if (!product || !Number.isFinite(quantity)) return sum;
    return sum + Number(product.price) * quantity;
  }, 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    if (!customerId) {
      setError("Please choose a customer.");
      return;
    }
    if (lines.some((line) => !line.productId)) {
      setError("Please choose a product for every line.");
      return;
    }
    const chosen = lines.map((line) => line.productId);
    if (new Set(chosen).size !== chosen.length) {
      setError(
        "A product appears more than once. Combine it into a single line.",
      );
      return;
    }
    createOrder.mutate({
      customerId: Number(customerId),
      items: lines.map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
      })),
    });
  };

  return (
    <>
      <h1>Orders</h1>

      <section className="card">
        <h2>Place an order</h2>
        {customersQuery.isLoading && <p className="muted">Loading customers…</p>}
        {customersQuery.isError && (
          <p className="error">
            Could not load customers: {readableError(customersQuery.error.message)}
          </p>
        )}
        {customersQuery.isSuccess && customers.length === 0 && (
          <p className="muted">Add a customer first to place an order.</p>
        )}
        {productsQuery.isLoading && <p className="muted">Loading products…</p>}
        {productsQuery.isError && (
          <p className="error">
            Could not load products: {readableError(productsQuery.error.message)}
          </p>
        )}
        {productsQuery.isSuccess && products.length === 0 && (
          <p className="muted">Add a product first to place an order.</p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid">
            <label className="full">
              Customer
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={customersQuery.isLoading || customersQuery.isError}
                required
              >
                <option value="">
                  {customersQuery.isLoading
                    ? "Loading customers…"
                    : customersQuery.isError
                      ? "Customers could not be loaded"
                      : "Choose a customer…"}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} — {c.contactName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="order-lines">
            {lines.map((line, index) => {
              const product = productById.get(line.productId);
              return (
                <div className="order-line" key={index}>
                  <label>
                    Product
                    <select
                      value={line.productId}
                      onChange={(e) =>
                        setLine(index, { productId: e.target.value })
                      }
                      disabled={productsQuery.isLoading || productsQuery.isError}
                      required
                    >
                      <option value="">
                        {productsQuery.isLoading
                          ? "Loading products…"
                          : productsQuery.isError
                            ? "Products could not be loaded"
                            : "Choose a product…"}
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatPrice(p.price)}, {p.stock} in stock)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(e) =>
                        setLine(index, { quantity: e.target.value })
                      }
                      required
                    />
                  </label>
                  <span className="line-info">
                    {product && (
                      <span
                        className={
                          Number(line.quantity) > product.stock
                            ? "error"
                            : "muted"
                        }
                      >
                        {Number(line.quantity) > product.stock
                          ? `Only ${product.stock} in stock`
                          : formatPrice(
                              Number(product.price) * Number(line.quantity || 0),
                            )}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="link-button danger-link"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    disabled={lines.length === 1}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <div className="order-form-footer">
            <button
              type="button"
              className="secondary"
              onClick={() => setLines((current) => [...current, { ...emptyLine }])}
            >
              Add another product
            </button>
            <span className="order-total">Total: {formatPrice(total)}</span>
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button type="submit" disabled={createOrder.isPending}>
            {createOrder.isPending ? "Placing order…" : "Place order"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>
          All orders
          {ordersQuery.isSuccess && <span className="count"> ({orders.length})</span>}
        </h2>
        {ordersQuery.isLoading && <p className="muted">Loading…</p>}
        {ordersQuery.isError && (
          <p className="error">Could not load orders: {ordersQuery.error.message}</p>
        )}
        {ordersQuery.isSuccess && orders.length === 0 && (
          <p className="muted">No orders yet. Place your first one above.</p>
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
