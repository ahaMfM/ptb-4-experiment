import { useState } from "react";
import CustomersPage from "./CustomersPage";
import OrdersPage from "./OrdersPage";
import ProductsPage from "./ProductsPage";

type Page = "products" | "customers" | "orders";

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
      </nav>
      {page === "products" && <ProductsPage />}
      {page === "customers" && <CustomersPage />}
      {page === "orders" && <OrdersPage />}
    </main>
  );
}
