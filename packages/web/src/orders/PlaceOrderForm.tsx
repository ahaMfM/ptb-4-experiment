import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Product } from "server/router";
import { readableError } from "../lib/errors";
import { formatPrice } from "../lib/format";
import { useTRPC } from "../trpc";

/** One line of the order being put together; both values as typed. */
type OrderLine = {
  productId: string; // "" while none chosen
  quantity: string;
};

const blankLine: OrderLine = { productId: "", quantity: "1" };

/** Product, quantity and what that line comes to — or what is missing. */
function OrderLineFields({
  line,
  products,
  onChange,
  onRemove,
  removable,
}: {
  line: OrderLine;
  products: Product[];
  onChange: (patch: Partial<OrderLine>) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const product = products.find((p) => String(p.id) === line.productId);
  const quantity = Number(line.quantity);
  const shortOfStock = product !== undefined && quantity > product.stock;

  return (
    <div className="order-line">
      <label>
        Product
        <select
          value={line.productId}
          onChange={(e) => onChange({ productId: e.target.value })}
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
          onChange={(e) => onChange({ quantity: e.target.value })}
          required
        />
      </label>
      <span className="line-info">
        {product && (
          <span className={shortOfStock ? "error" : "muted"}>
            {shortOfStock
              ? `Only ${product.stock} in stock`
              : formatPrice(Number(product.price) * Number(line.quantity || 0))}
          </span>
        )}
      </span>
      <button
        type="button"
        className="link-button danger-link"
        onClick={onRemove}
        disabled={!removable}
      >
        Remove
      </button>
    </div>
  );
}

/**
 * Put an order together: one customer, one or more products with
 * quantities. Placing it takes the quantities off stock, so the product
 * list is refreshed along with the order list.
 */
export default function PlaceOrderForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ ...blankLine }]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const customersQuery = useQuery(trpc.customer.list.queryOptions());
  const productsQuery = useQuery(trpc.product.list.queryOptions());
  const customers = customersQuery.data ?? [];
  const products = productsQuery.data ?? [];

  const createOrder = useMutation(
    trpc.order.create.mutationOptions({
      onSuccess: async (order) => {
        setCustomerId("");
        setLines([{ ...blankLine }]);
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

  const total = lines.reduce((sum, line) => {
    const product = products.find((p) => String(p.id) === line.productId);
    const quantity = Number(line.quantity);
    if (!product || !Number.isFinite(quantity)) return sum;
    return sum + Number(product.price) * quantity;
  }, 0);

  /** What keeps this order from being placed, if anything. */
  const findProblem = (): string | null => {
    if (!customerId) return "Please choose a customer.";
    if (lines.some((line) => !line.productId)) {
      return "Please choose a product for every line.";
    }
    const chosen = lines.map((line) => line.productId);
    if (new Set(chosen).size !== chosen.length) {
      return "A product appears more than once. Combine it into a single line.";
    }
    return null;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    const problem = findProblem();
    if (problem) {
      setError(problem);
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
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company} — {customer.contactName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="order-lines">
          {lines.map((line, index) => (
            <OrderLineFields
              key={index}
              line={line}
              products={products}
              removable={lines.length > 1}
              onChange={(patch) =>
                setLines((current) =>
                  current.map((existing, i) =>
                    i === index ? { ...existing, ...patch } : existing,
                  ),
                )
              }
              onRemove={() =>
                setLines((current) => current.filter((_, i) => i !== index))
              }
            />
          ))}
        </div>

        <div className="order-form-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => setLines((current) => [...current, { ...blankLine }])}
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
  );
}
