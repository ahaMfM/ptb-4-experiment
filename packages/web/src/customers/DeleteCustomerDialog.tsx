import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CustomerRecord } from "server/router";
import ConfirmDeleteDialog from "../components/ConfirmDeleteDialog";
import { readableError } from "../lib/errors";
import { useTRPC } from "../trpc";

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
      onError: (err) => setError(readableError(err.message)),
    }),
  );

  return (
    <ConfirmDeleteDialog
      ariaLabel="Delete customer"
      heading="Delete customer?"
      confirmLabel="Delete customer"
      pending={removeCustomer.isPending}
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
