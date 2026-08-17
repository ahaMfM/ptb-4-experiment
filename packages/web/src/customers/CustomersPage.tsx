import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { CustomerRecord } from "server/router";
import QueryFeedback from "../components/QueryFeedback";
import { readableError } from "../lib/errors";
import { downloadFile } from "../lib/export";
import { formatDate, formatDateTime, todayIso } from "../lib/format";
import { useTRPC } from "../trpc";
import CustomerDetailDialog from "./CustomerDetailDialog";
import CustomerFormFields, { emptyCustomerForm } from "./CustomerFormFields";
import { customersToCsv } from "./customersCsv";
import DeleteCustomerDialog from "./DeleteCustomerDialog";
import EditCustomerDialog from "./EditCustomerDialog";

/** Who we trade with: add customers, search them, and look into their orders. */
export default function CustomersPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyCustomerForm);
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
  const customers = customersQuery.data ?? [];

  const createCustomer = useMutation(
    trpc.customer.create.mutationOptions({
      onSuccess: async () => {
        setForm(emptyCustomerForm());
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
        `customers-${todayIso()}.csv`,
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

  return (
    <>
      <h1>Customers</h1>

      <section className="card">
        <h2>Add a customer</h2>
        <form onSubmit={handleSubmit}>
          <CustomerFormFields
            form={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
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
            {customersQuery.isSuccess && (
              <span className="count"> ({customers.length})</span>
            )}
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
        <QueryFeedback
          query={customersQuery}
          errorPrefix="Could not load customers"
        />
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
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="clickable"
                    onClick={() => setViewing(customer)}
                  >
                    <td>{customer.firstName}</td>
                    <td>{customer.familyName}</td>
                    <td>{customer.company}</td>
                    <td className="address">{customer.address}</td>
                    <td>
                      <a
                        href={`mailto:${customer.email}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {customer.email}
                      </a>
                    </td>
                    <td>{formatDate(customer.customerSince)}</td>
                    <td>
                      {customer.recordedBy ? (
                        <>
                          {customer.recordedBy}
                          {customer.createdAt && (
                            <>
                              <br />
                              <span className="muted">
                                {formatDateTime(customer.createdAt)}
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
                            setViewing(customer);
                          }}
                        >
                          Orders
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(customer);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="link-button danger-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(customer);
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
