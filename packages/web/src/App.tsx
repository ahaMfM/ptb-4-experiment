import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import CustomersPage from "./CustomersPage";
import InvoicesPage from "./InvoicesPage";
import OrdersPage from "./OrdersPage";
import ProductsPage from "./ProductsPage";
import { useTRPC } from "./trpc";

type Page = "products" | "customers" | "orders" | "invoices";

export default function App() {
  const trpc = useTRPC();
  const [page, setPage] = useState<Page>("products");

  const unpaidQuery = useQuery(trpc.invoice.unpaidCount.queryOptions());
  const unpaidCount = unpaidQuery.data ?? 0;

  return (
    <main>
      <nav className="tabs" aria-label="Main navigation">
        <button
          type="button"
          className={page === "products" ? "tab active" : "tab"}
          onClick={() => setPage("products")}
        >
          Products
        </button>
        <button
          type="button"
          className={page === "customers" ? "tab active" : "tab"}
          onClick={() => setPage("customers")}
        >
          Customers
        </button>
        <button
          type="button"
          className={page === "orders" ? "tab active" : "tab"}
          onClick={() => setPage("orders")}
        >
          Orders
        </button>
        <button
          type="button"
          className={page === "invoices" ? "tab active" : "tab"}
          onClick={() => setPage("invoices")}
        >
          Invoices
          {unpaidQuery.isSuccess && unpaidCount > 0 && (
            <span
              className="tab-badge"
              aria-label={`${unpaidCount} unpaid ${unpaidCount === 1 ? "invoice" : "invoices"}`}
            >
              {unpaidCount}
            </span>
          )}
        </button>
      </nav>

      {page === "products" && unpaidQuery.isSuccess && (
        <button
          type="button"
          className={
            unpaidCount > 0 ? "unpaid-banner has-unpaid" : "unpaid-banner"
          }
          onClick={() => setPage("invoices")}
        >
          {unpaidCount === 0
            ? "No unpaid invoices — everything has been paid."
            : unpaidCount === 1
              ? "1 invoice is currently unpaid."
              : `${unpaidCount} invoices are currently unpaid.`}
          <span className="unpaid-banner-link">View invoices</span>
        </button>
      )}

      {page === "products" && <ProductsPage />}
      {page === "customers" && <CustomersPage />}
      {page === "orders" && <OrdersPage />}
      {page === "invoices" && <InvoicesPage />}
    </main>
  );
}
