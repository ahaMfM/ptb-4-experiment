import type { CustomerRecord } from "server/router";
import { todayUtc } from "../../lib/format";

/**
 * The customer form: what it holds while being filled in and how it is
 * rendered. Its values are exactly what `customer.create` and
 * `customer.update` take, so callers pass them on unchanged.
 */

export type CustomerFormValues = {
  contactName: string;
  company: string;
  address: string;
  email: string;
  /** Not every customer gives us one. */
  vatNumber: string;
  /** Plain calendar date, YYYY-MM-DD. */
  customerSince: string;
};

/** A blank form; a new customer is a customer as of today. */
export const emptyCustomerForm: CustomerFormValues = {
  contactName: "",
  company: "",
  address: "",
  email: "",
  vatNumber: "",
  customerSince: todayUtc(),
};

/** Fill the form from an existing customer, for editing. */
export function customerFormValues(customer: CustomerRecord): CustomerFormValues {
  return {
    contactName: customer.contactName,
    company: customer.company,
    address: customer.address,
    email: customer.email,
    vatNumber: customer.vatNumber ?? "",
    customerSince: customer.customerSince,
  };
}

export function CustomerFields({
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
        VAT number
        <input
          value={form.vatNumber}
          onChange={set("vatNumber")}
          placeholder="DE123456789"
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
