import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CustomerRecord } from "server/router";
import { readableError } from "../../lib/errors";
import { useTRPC } from "../../trpc";
import ConfirmDeleteDialog from "../../ui/ConfirmDeleteDialog";

export default function DeleteCustomerDialog({
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
      // A customer with orders on record cannot be deleted; the server says so
      // and the dialog stays open with the reason.
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  return (
    <ConfirmDeleteDialog
      label="Delete customer"
      title="Delete customer?"
      confirmLabel="Delete customer"
      pendingLabel="Deleting…"
      isPending={removeCustomer.isPending}
      error={error}
      onConfirm={() => removeCustomer.mutate({ id: customer.id })}
      onClose={onClose}
    >
      This will permanently remove{" "}
      <strong>
        {customer.firstName} {customer.familyName} ({customer.company})
      </strong>{" "}
      from the customer list. This cannot be undone.
    </ConfirmDeleteDialog>
  );
}
