import { useState } from "react";
import CustomersPage from "./CustomersPage";
import InvoicesPage from "./InvoicesPage";
import OrdersPage from "./OrdersPage";
import ProductsPage from "./ProductsPage";

type Page = "products" | "customers" | "orders" | "invoices";

export default function App() {
  const [page, setPage] = useState<Page>("products");

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
        </button>
      </nav>
      {page === "products" && <ProductsPage />}
      {page === "customers" && <CustomersPage />}
      {page === "orders" && <OrdersPage />}
      {page === "invoices" && <InvoicesPage />}
    </main>
  );
}
