import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicUser } from "server/router";
import CustomersPage from "./CustomersPage";
import InvoicesPage from "./InvoicesPage";
import OrdersPage from "./OrdersPage";
import ProductsPage from "./ProductsPage";
import SignInPage from "./SignInPage";
import TeamPage from "./TeamPage";
import { useTRPC } from "./trpc";
import { useUrlParam } from "./utils";

type Page = "products" | "customers" | "orders" | "invoices" | "team";
const PAGES: Page[] = ["products", "customers", "orders", "invoices", "team"];

/**
 * Everyone signs in as themselves before using the application, so the app
 * only appears once we know who is at the keyboard.
 */
export default function App() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const meQuery = useQuery(trpc.auth.me.queryOptions());
  const signOut = useMutation(
    trpc.auth.signOut.mutationOptions({
      onSuccess: () => {
        // Drop everything the previous user had loaded; the sign-in check
        // re-runs and brings the sign-in screen back.
        queryClient.clear();
      },
    }),
  );

  if (meQuery.isPending) {
    return (
      <main>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (meQuery.isError) {
    return (
      <main>
        <p className="error">
          The application could not be reached. Please try again in a moment.
        </p>
      </main>
    );
  }

  if (!meQuery.data) {
    return (
      <main>
        <SignInPage />
      </main>
    );
  }

  return (
    <BackOffice
      user={meQuery.data}
      onSignOut={() => signOut.mutate()}
      signingOut={signOut.isPending}
    />
  );
}

function BackOffice({
  user,
  onSignOut,
  signingOut,
}: {
  user: PublicUser;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const trpc = useTRPC();
  const [pageParam, setPageParam] = useUrlParam("page", "products");
  const page = PAGES.includes(pageParam as Page) ? (pageParam as Page) : "products";
  const setPage = (next: Page) => setPageParam(next);

  const unpaidQuery = useQuery(trpc.invoice.unpaidCount.queryOptions());
  const unpaidCount = unpaidQuery.data ?? 0;

  return (
    <main>
      <div className="topbar">
        <span className="muted">
          Signed in as <strong>{user.name}</strong>
        </span>
        <button
          type="button"
          className="link-button"
          onClick={onSignOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>

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
        <button
          type="button"
          className={page === "team" ? "tab active" : "tab"}
          onClick={() => setPage("team")}
        >
          Team
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
      {page === "team" && <TeamPage />}
    </main>
  );
}
