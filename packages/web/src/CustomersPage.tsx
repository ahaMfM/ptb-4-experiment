import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { CustomerRecord } from "server/router";
import StatusBadge from "./StatusBadge";
import { useTRPC } from "./trpc";
import {
  downloadFile,
  formatDate,
  formatDateTime,
  formatPrice,
  readableError,
  toCsv,
} from "./utils";

const today = () => new Date().toISOString().slice(0, 10);

type CustomerFormValues = {
  firstName: string;
  familyName: string;
  company: string;
  address: string;
  email: string;
  customerSince: string;
};

/**
 * Turn a customer list into a CSV file with every stored field, e.g. to
 * hand the complete customer data to the accountant.
 */
function customersToCsv(list: CustomerRecord[]): string {
  return toCsv(
    [
      "ID",
      "First name",
      "Family name",
      "Company",
      "Address",
      "E-mail",
      "Customer since",
      "Recorded by",
      "Recorded at",
    ],
    list.map((c) => [
      c.id,
      c.firstName,
      c.familyName,
      c.company,
      c.address,
      c.email,
      c.customerSince,
      // Empty for entries from before we tracked who recorded what.
      c.recordedBy ?? "",
      c.createdAt ?? "",
    ]),
  );
}

const emptyForm: CustomerFormValues = {
  firstName: "",
  familyName: "",
  company: "",
  address: "",
  email: "",
  customerSince: today(),
};

function CustomerFields({
  form,
  onChange,
}: {
  form: CustomerFormValues;
  onChange: (field: keyof CustomerFormValues, value: string) => void;
}) {
  const set =
    (field: keyof CustomerFormValues) =>
    (e: { target: { value: string } }) =>
      onChange(field, e.target.value);

  return (
    <div className="grid">
      <label>
        First name
        <input
          value={form.firstName}
          onChange={set("firstName")}
          placeholder="Jane"
          required
        />
      </label>
      <label>
        Family name
        <input
          value={form.familyName}
          onChange={set("familyName")}
          placeholder="Doe"
          required
        />
      </label>
      <label>
        Company
        <input
          value={form.company}
          onChange={set("company")}
          placeholder="Acme Trading GmbH"
          required
        />
      </label>
      <label>
        E-mail address
        <input
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="jane.doe@acme.example"
          required
        />
      </label>
      <label>
        Customer since
        <input
          type="date"
          value={form.customerSince}
          onChange={set("customerSince")}
          required
        />
      </label>
      <label className="full">
        Address
        <textarea
          value={form.address}
          onChange={set("address")}
          placeholder={"Musterstrasse 1\n10115 Berlin"}
          rows={2}
          required
        />
      </label>
    </div>
  );
}

/**
 * Everything about one customer at a glance: contact details plus every
 * order they have placed and whether it is open, shipped or cancelled.
 */
function CustomerDetailDialog({
  customer,
  onClose,
}: {
  customer: CustomerRecord;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const ordersQuery = useQuery(
    trpc.customer.orders.queryOptions({ customerId: customer.id }),
  );
  const orders = ordersQuery.data ?? [];

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
        aria-label={`Customer ${customer.firstName} ${customer.familyName}`}
      >
        <header className="order-header">
          <h2>{customer.company}</h2>
          <span className="muted">Customer #{customer.id}</span>
        </header>

        <div className="detail-grid">
          <div>
            <span className="detail-label">First name</span>
            {customer.firstName}
          </div>
          <div>
            <span className="detail-label">Family name</span>
            {customer.familyName}
          </div>
          <div>
            <span className="detail-label">E-mail</span>
            <a href={`mailto:${customer.email}`}>{customer.email}</a>
          </div>
          <div>
            <span className="detail-label">Customer since</span>
            {formatDate(customer.customerSince)}
          </div>
          <div>
            <span className="detail-label">Address</span>
            <span className="address">{customer.address}</span>
          </div>
          <div>
            <span className="detail-label">Recorded by</span>
            {customer.recordedBy ? (
              <>
                {customer.recordedBy}
                {customer.createdAt && (
                  <span className="muted">
                    {" "}
                    on {formatDateTime(customer.createdAt)}
                  </span>
                )}
              </>
            ) : (
              // Entries from before everyone signed in: we do not know.
              <span className="muted">—</span>
            )}
          </div>
        </div>

        <h3>
          Orders
          {ordersQuery.isSuccess && <span className="count"> ({orders.length})</span>}
        </h3>
        {ordersQuery.isLoading && <p className="muted">Loading…</p>}
        {ordersQuery.isError && (
          <p className="error">
            Could not load orders: {readableError(ordersQuery.error.message)}
          </p>
        )}
        {ordersQuery.isSuccess && orders.length === 0 && (
          <p className="muted">This customer has not placed any orders yet.</p>
        )}
        {orders.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Recorded by</th>
                  <th>Contents</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="actions">
          <button type="button" className="secondary" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteCustomerDialog({
  customer,
  onClose,
}: {
  customer: CustomerRecord;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const removeCustomer = useMutation(
    trpc.customer.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.customer.list.queryFilter());
        onClose();
      },
      onError: (err) => setError(readableError(err.message)),
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
        className="modal card"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete customer"
      >
        <h2>Delete customer?</h2>
        <p>
          This will permanently remove{" "}
          <strong>
            {customer.firstName} {customer.familyName} ({customer.company})
          </strong>{" "}
          from the customer list. This cannot be undone.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button
            type="button"
            className="danger"
            onClick={() => removeCustomer.mutate({ id: customer.id })}
            disabled={removeCustomer.isPending}
          >
            {removeCustomer.isPending ? "Deleting…" : "Delete customer"}
          </button>
          <button type="button" className="secondary" onClick={onClose} autoFocus>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCustomerDialog({
  customer,
  onClose,
}: {
  customer: CustomerRecord;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerFormValues>({
    firstName: customer.firstName,
    familyName: customer.familyName,
    company: customer.company,
    address: customer.address,
    email: customer.email,
    customerSince: customer.customerSince,
  });
  const [error, setError] = useState<string | null>(null);

  const updateCustomer = useMutation(
    trpc.customer.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.customer.list.queryFilter());
        onClose();
      },
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateCustomer.mutate({ id: customer.id, ...form });
  };

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal card" role="dialog" aria-modal="true" aria-label="Edit customer">
        <h2>Edit customer</h2>
        <form onSubmit={handleSubmit}>
          <CustomerFields
            form={form}
            onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
          />
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="submit" disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CustomerRecord | null>(null);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [deleting, setDeleting] = useState<CustomerRecord | null>(null);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const trimmedSearch = search.trim();
  const customersQuery = useQuery({
    ...trpc.customer.list.queryOptions(
      trimmedSearch ? { search: trimmedSearch } : undefined,
    ),
    placeholderData: (previous) => previous,
  });

  const createCustomer = useMutation(
    trpc.customer.create.mutationOptions({
      onSuccess: async () => {
        setForm({ ...emptyForm, customerSince: today() });
        setError(null);
        await queryClient.invalidateQueries(trpc.customer.list.queryFilter());
      },
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createCustomer.mutate(form);
  };

  /**
   * Download every customer with all stored fields as a CSV file.
   * Always exports the full list, even while a search filter is active.
   */
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const all = await queryClient.fetchQuery(
        trpc.customer.list.queryOptions(undefined),
      );
      downloadFile(
        `customers-${today()}.csv`,
        customersToCsv(all),
        "text/csv;charset=utf-8",
      );
    } catch (err) {
      setExportError(
        readableError(err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setExporting(false);
    }
  };

  const customers = customersQuery.data ?? [];

  return (
    <>
      <h1>Customers</h1>

      <section className="card">
        <h2>Add a customer</h2>
        <form onSubmit={handleSubmit}>
          <CustomerFields
            form={form}
            onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Adding…" : "Add customer"}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="list-header">
          <h2>
            All customers
            {customersQuery.isSuccess && <span className="count"> ({customers.length})</span>}
          </h2>
          <input
            type="search"
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or company…"
            aria-label="Search customers by name"
          />
          <button
            type="button"
            className="secondary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
        {exportError && (
          <p className="error">Could not export customers: {exportError}</p>
        )}
        {customersQuery.isLoading && <p className="muted">Loading…</p>}
        {customersQuery.isError && (
          <p className="error">Could not load customers: {customersQuery.error.message}</p>
        )}
        {customersQuery.isSuccess && customers.length === 0 && (
          <p className="muted">
            {trimmedSearch
              ? `No customers match “${trimmedSearch}”.`
              : "No customers yet. Add your first one above."}
          </p>
        )}
        {customers.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>First name</th>
                  <th>Family name</th>
                  <th>Company</th>
                  <th>Address</th>
                  <th>E-mail</th>
                  <th>Customer since</th>
                  <th>Recorded by</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setViewing(c)}>
                    <td>{c.firstName}</td>
                    <td>{c.familyName}</td>
                    <td>{c.company}</td>
                    <td className="address">{c.address}</td>
                    <td>
                      <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>
                        {c.email}
                      </a>
                    </td>
                    <td>{formatDate(c.customerSince)}</td>
                    <td>
                      {c.recordedBy ? (
                        <>
                          {c.recordedBy}
                          {c.createdAt && (
                            <>
                              <br />
                              <span className="muted">
                                {formatDateTime(c.createdAt)}
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        // Entries from before everyone signed in: unknown.
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="row-actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewing(c);
                          }}
                        >
                          Orders
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(c);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="link-button danger-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(c);
                          }}
                        >
                          Delete
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

      {viewing && (
        <CustomerDetailDialog
          key={viewing.id}
          customer={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {editing && (
        <EditCustomerDialog
          key={editing.id}
          customer={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <DeleteCustomerDialog
          key={deleting.id}
          customer={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
