import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { CustomerRecord } from "server/router";
import { readableError } from "../../lib/errors";
import { useTRPC } from "../../trpc";
import EditDialog from "../../ui/EditDialog";
import {
  CustomerFields,
  customerFormValues,
  type CustomerFormValues,
} from "./CustomerForm";

export default function EditCustomerDialog({
  customer,
  onClose,
}: {
  customer: CustomerRecord;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerFormValues>(
    customerFormValues(customer),
  );
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
    <EditDialog
      label="Edit customer"
      title="Edit customer"
      isPending={updateCustomer.isPending}
      error={error}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <CustomerFields
        form={form}
        onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
      />
    </EditDialog>
  );
}
