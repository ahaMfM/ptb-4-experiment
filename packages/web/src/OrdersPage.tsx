import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTRPC } from "./trpc";
import { formatPrice, readableError } from "./utils";

type OrderLine = {
  productId: string; // "" while none chosen
  quantity: string;
};

const emptyLine: OrderLine = { productId: "", quantity: "1" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ ...emptyLine }]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        setSuccess(`Order #${order.id} was placed and stock has been updated.`);
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
        {customersQuery.isSuccess && customers.length === 0 && (
          <p className="muted">Add a customer first to place an order.</p>
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
                required
              >
                <option value="">Choose a customer…</option>
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
                      required
                    >
                      <option value="">Choose a product…</option>
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
        {orders.map((order) => (
          <article key={order.id} className="order">
            <header className="order-header">
              <h3>
                Order #{order.id} — {order.company} ({order.contactName})
              </h3>
              <span className="muted">{formatDateTime(order.createdAt)}</span>
            </header>
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
          </article>
        ))}
      </section>
    </>
  );
}
