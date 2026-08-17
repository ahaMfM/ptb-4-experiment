import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { CustomerRecord } from "server/router";
import Modal from "../components/Modal";
import { readableError } from "../lib/errors";
import { useTRPC } from "../trpc";
import CustomerFormFields, {
  type CustomerFormValues,
} from "./CustomerFormFields";

export default function EditCustomerDialog({
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
    <Modal ariaLabel="Edit customer" onClose={onClose}>
      <h2>Edit customer</h2>
      <form onSubmit={handleSubmit}>
        <CustomerFormFields
          form={form}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
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
    </Modal>
  );
}
