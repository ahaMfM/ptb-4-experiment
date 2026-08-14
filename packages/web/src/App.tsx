import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTRPC } from "./trpc";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  contactName: "",
  company: "",
  address: "",
  email: "",
  customerSince: today(),
};

/** Zod validation errors arrive as a JSON array in the message; show just the texts. */
function readableError(message: string): string {
  try {
    const issues = JSON.parse(message) as Array<{ message?: string }>;
    if (Array.isArray(issues)) {
      const texts = issues.map((i) => i.message).filter(Boolean);
      if (texts.length > 0) return texts.join(" ");
    }
  } catch {
    // not JSON — fall through
  }
  return message;
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function App() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useQuery(trpc.customer.list.queryOptions());

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

  const set =
    (field: keyof typeof emptyForm) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createCustomer.mutate(form);
  };

  const customers = customersQuery.data ?? [];

  return (
    <main>
      <h1>Customers</h1>

      <section className="card">
        <h2>Add a customer</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid">
            <label>
              Contact person
              <input
                value={form.contactName}
                onChange={set("contactName")}
                placeholder="Jane Doe"
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
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Adding…" : "Add customer"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>
          All customers
          {customersQuery.isSuccess && <span className="count"> ({customers.length})</span>}
        </h2>
        {customersQuery.isLoading && <p className="muted">Loading…</p>}
        {customersQuery.isError && (
          <p className="error">Could not load customers: {customersQuery.error.message}</p>
        )}
        {customersQuery.isSuccess && customers.length === 0 && (
          <p className="muted">No customers yet. Add your first one above.</p>
        )}
        {customers.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contact person</th>
                  <th>Company</th>
                  <th>Address</th>
                  <th>E-mail</th>
                  <th>Customer since</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.contactName}</td>
                    <td>{c.company}</td>
                    <td className="address">{c.address}</td>
                    <td>
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </td>
                    <td>{formatDate(c.customerSince)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
