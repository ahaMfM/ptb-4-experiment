import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { readableError } from "../lib/errors";
import { formatDate, formatPrice, todayIso } from "../lib/format";
import { useTRPC } from "../trpc";

/** Records that a customer has paid an invoice, on a date one picks. */
export default function RecordPaymentForm({
  invoiceId,
  onDone,
}: {
  invoiceId: number;
  onDone: (message: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [paidAt, setPaidAt] = useState(todayIso());

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
          max={todayIso()}
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
