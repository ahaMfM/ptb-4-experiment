import { useState } from "react";
import CustomersPage from "./CustomersPage";
import ProductsPage from "./ProductsPage";

type Page = "products" | "customers";

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
      </nav>
      {page === "products" ? <ProductsPage /> : <CustomersPage />}
    </main>
  );
}
