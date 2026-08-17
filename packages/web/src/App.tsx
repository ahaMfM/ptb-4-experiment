import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ComponentType } from "react";
import type { PublicUser } from "server/router";
import SignInPage from "./auth/SignInPage";
import CustomersPage from "./customers/CustomersPage";
import InvoicesPage from "./invoices/InvoicesPage";
import OrdersPage from "./orders/OrdersPage";
import ProductsPage from "./products/ProductsPage";
import TeamPage from "./team/TeamPage";
import { useTRPC } from "./trpc";
import { getSearchParam, setSearchParam } from "./lib/url";

/** The screens of the back office, in the order the tabs show them. */
const PAGES = [
  { id: "products", label: "Products", Screen: ProductsPage },
  { id: "customers", label: "Customers", Screen: CustomersPage },
  { id: "orders", label: "Orders", Screen: OrdersPage },
  { id: "invoices", label: "Invoices", Screen: InvoicesPage },
  { id: "team", label: "Team", Screen: TeamPage },
] as const satisfies readonly {
  id: string;
  label: string;
  Screen: ComponentType;
}[];

type PageId = (typeof PAGES)[number]["id"];

/** The tab to show on load: whatever the URL names, else the first tab. */
function initialPage(): PageId {
  const tab = getSearchParam("tab");
  return PAGES.some((page) => page.id === tab) ? (tab as PageId) : "products";
}

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

/** How many invoices are waiting for payment, in words. */
function unpaidSummary(unpaidCount: number): string {
  if (unpaidCount === 0) return "No unpaid invoices — everything has been paid.";
  if (unpaidCount === 1) return "1 invoice is currently unpaid.";
  return `${unpaidCount} invoices are currently unpaid.`;
}

/** The application itself: the tab bar and whichever screen is chosen. */
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
  const [page, setPageState] = useState<PageId>(initialPage);

  function setPage(id: PageId) {
    setPageState(id);
    setSearchParam("tab", id);
  }

  const unpaidQuery = useQuery(trpc.invoice.unpaidCount.queryOptions());
  const unpaidCount = unpaidQuery.data ?? 0;
  const showUnpaid = unpaidQuery.isSuccess;

  const { Screen } = PAGES.find((candidate) => candidate.id === page)!;

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
        {PAGES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={page === id ? "tab active" : "tab"}
            onClick={() => setPage(id)}
          >
            {label}
            {id === "invoices" && showUnpaid && unpaidCount > 0 && (
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

      {/* The start screen leads with the open receivables. */}
      {page === "products" && showUnpaid && (
        <button
          type="button"
          className={
            unpaidCount > 0 ? "unpaid-banner has-unpaid" : "unpaid-banner"
          }
          onClick={() => setPage("invoices")}
        >
          {unpaidSummary(unpaidCount)}
          <span className="unpaid-banner-link">View invoices</span>
        </button>
      )}

      <Screen />
    </main>
  );
}
