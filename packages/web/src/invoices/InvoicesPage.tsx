import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCanWrite } from "../auth/CurrentUserContext";
import QueryFeedback from "../components/QueryFeedback";
import StatusBadge from "../components/StatusBadge";
import { formatDate, formatDateTime, formatPrice } from "../lib/format";
import { useTRPC } from "../trpc";
import RecordPaymentForm from "./RecordPaymentForm";

/** What has been invoiced, what is still outstanding, and who paid when. */
export default function InvoicesPage() {
  const trpc = useTRPC();
  const canWrite = useCanWrite();
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const invoicesQuery = useQuery(trpc.invoice.list.queryOptions({ unpaidOnly }));
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

        <QueryFeedback
          query={invoicesQuery}
          errorPrefix="Could not load invoices"
        />
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
                      ) : canWrite ? (
                        <RecordPaymentForm
                          invoiceId={invoice.id}
                          onDone={setSuccess}
                        />
                      ) : (
                        <span className="muted">Unpaid</span>
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
