import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PublicUser } from "server/router";
import { CurrentUserProvider } from "./lib/currentUser";
import CustomersPage from "./pages/customers/CustomersPage";
import InvoicesPage from "./pages/InvoicesPage";
import OrdersPage from "./pages/orders/OrdersPage";
import ProductsPage from "./pages/products/ProductsPage";
import SignInPage from "./pages/SignInPage";
import TeamPage from "./pages/TeamPage";
import { useTRPC } from "./trpc";

/**
 * The screens the application is made of, in the order they appear in the
 * navigation. Adding one here is all it takes: the tabs and what they show
 * both come from this list.
 */
const PAGES = [
  { id: "products", label: "Products", Component: ProductsPage },
  { id: "customers", label: "Customers", Component: CustomersPage },
  { id: "orders", label: "Orders", Component: OrdersPage },
  { id: "invoices", label: "Invoices", Component: InvoicesPage },
  { id: "team", label: "Team", Component: TeamPage },
] as const;

type Page = (typeof PAGES)[number]["id"];

/** The screen shown first after signing in. */
const HOME: Page = "products";

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
  const [page, setPage] = useState<Page>(HOME);

  // Open receivables are visible from anywhere: as a count on the Invoices
  // tab, and spelled out on the start screen.
  const unpaidQuery = useQuery(trpc.invoice.unpaidCount.queryOptions());
  const unpaidCount = unpaidQuery.data ?? 0;

  const current = PAGES.find((entry) => entry.id === page)!;

  return (
    <CurrentUserProvider user={user}>
      <main>
        <div className="topbar">
          <span className="muted">
            Signed in as <strong>{user.name}</strong>
            {user.role === "viewer" && <span className="muted"> (read-only)</span>}
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
          {PAGES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={page === entry.id ? "tab active" : "tab"}
              onClick={() => setPage(entry.id)}
            >
              {entry.label}
              {entry.id === "invoices" && unpaidQuery.isSuccess && unpaidCount > 0 && (
                <span
                  className="tab-badge"
                  aria-label={`${unpaidCount} unpaid ${unpaidCount === 1 ? "invoice" : "invoices"}`}
                >
                  {unpaidCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {page === HOME && unpaidQuery.isSuccess && (
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

        <current.Component />
      </main>
    </CurrentUserProvider>
  );
}
