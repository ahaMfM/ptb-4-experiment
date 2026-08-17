import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { readableError } from "../lib/errors";
import {
  formatDate,
  formatDateTime,
  formatPrice,
  todayLocal,
} from "../lib/format";
import { useTRPC } from "../trpc";
import StatusBadge from "../ui/StatusBadge";

/**
 * Recording a payment against one invoice. Defaults to today and refuses a
 * date in the future; the server has the last word on both.
 */
function RecordPaymentForm({
  invoiceId,
  onDone,
}: {
  invoiceId: number;
  onDone: (message: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [paidAt, setPaidAt] = useState(todayLocal());

  const markPaid = useMutation(
    trpc.invoice.markPaid.mutationOptions({
      onSuccess: async (invoice) => {
        // Refresh the invoice list and the unpaid count on the start screen.
        await queryClient.invalidateQueries(trpc.invoice.pathFilter());
        onDone(
          `Payment of ${formatPrice(invoice.amount)} for invoice #${invoice.id} recorded (paid on ${formatDate(invoice.paidAt ?? paidAt)}).`,
        );
      },
    }),
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    markPaid.mutate({ id: invoiceId, paidAt });
  };

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <label>
        <span className="visually-hidden">Payment date</span>
        <input
          type="date"
          value={paidAt}
          max={todayLocal()}
          onChange={(e) => setPaidAt(e.target.value)}
          required
        />
      </label>
      <button type="submit" className="link-button" disabled={markPaid.isPending}>
        {markPaid.isPending ? "Recording…" : "Record payment"}
      </button>
      {markPaid.isError && (
        <span className="error">{readableError(markPaid.error.message)}</span>
      )}
    </form>
  );
}

/**
 * Receivables: what has been invoiced, what is still outstanding, and
 * recording payments as they come in.
 */
export default function InvoicesPage() {
  const trpc = useTRPC();
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const invoicesQuery = useQuery(
    trpc.invoice.list.queryOptions({ unpaidOnly }),
  );
  const invoices = invoicesQuery.data ?? [];

  const unpaid = invoices.filter((invoice) => invoice.paidAt === null);
  const outstanding = unpaid.reduce(
    (sum, invoice) => sum + Number(invoice.amount),
    0,
  );

  return (
    <>
      <h1>Invoices</h1>

      <section className="card">
        <div className="invoice-toolbar">
          <h2>
            {unpaidOnly ? "Unpaid invoices" : "All invoices"}
            {invoicesQuery.isSuccess && (
              <span className="count"> ({invoices.length})</span>
            )}
          </h2>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={unpaidOnly}
              onChange={(e) => setUnpaidOnly(e.target.checked)}
            />
            Show unpaid only
          </label>
        </div>

        {invoicesQuery.isSuccess && unpaid.length > 0 && (
          <p className="muted">
            {unpaid.length === 1
              ? "1 invoice is unpaid"
              : `${unpaid.length} invoices are unpaid`}
            , {formatPrice(outstanding)} outstanding.
          </p>
        )}

        {invoicesQuery.isLoading && <p className="muted">Loading…</p>}
        {invoicesQuery.isError && (
          <p className="error">
            Could not load invoices: {readableError(invoicesQuery.error.message)}
          </p>
        )}
        {invoicesQuery.isSuccess && invoices.length === 0 && (
          <p className="muted">
            {unpaidOnly
              ? "No unpaid invoices — everything has been paid."
              : "No invoices yet. An invoice appears here as soon as an order is marked as shipped."}
          </p>
        )}
        {success && <p className="success">{success}</p>}

        {invoices.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Issued</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>#{invoice.id}</td>
                    <td>#{invoice.orderId}</td>
                    <td>
                      {invoice.company}
                      <br />
                      <span className="muted">{invoice.contactName}</span>
                    </td>
                    <td>{formatDateTime(invoice.issuedAt)}</td>
                    <td className="num">{formatPrice(invoice.amount)}</td>
                    <td>
                      <StatusBadge status={invoice.paidAt ? "paid" : "unpaid"} />
                    </td>
                    <td>
                      {invoice.paidAt ? (
                        <span>Paid on {formatDate(invoice.paidAt)}</span>
                      ) : (
                        <RecordPaymentForm
                          invoiceId={invoice.id}
                          onDone={setSuccess}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
