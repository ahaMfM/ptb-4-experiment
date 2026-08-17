import type { CustomerRecord } from "server/router";
import { todayUtc } from "../../lib/format";

/**
 * The customer form: what it holds while being filled in and how it is
 * rendered. Its values are exactly what `customer.create` and
 * `customer.update` take, so callers pass them on unchanged.
 */

export type CustomerFormValues = {
  firstName: string;
  familyName: string;
  company: string;
  address: string;
  email: string;
  /** Plain calendar date, YYYY-MM-DD. */
  customerSince: string;
};

/** A blank form; a new customer is a customer as of today. */
export const emptyCustomerForm: CustomerFormValues = {
  firstName: "",
  familyName: "",
  company: "",
  address: "",
  email: "",
  customerSince: todayUtc(),
};

/** Fill the form from an existing customer, for editing. */
export function customerFormValues(customer: CustomerRecord): CustomerFormValues {
  return {
    firstName: customer.firstName,
    familyName: customer.familyName,
    company: customer.company,
    address: customer.address,
    email: customer.email,
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
        First name
        <input
          value={form.firstName}
          onChange={set("firstName")}
          placeholder="Jane"
          required
        />
      </label>
      <label>
        Family name
        <input
          value={form.familyName}
          onChange={set("familyName")}
          placeholder="Doe"
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
  );
}
