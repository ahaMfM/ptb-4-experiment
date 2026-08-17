import { todayIso } from "../lib/format";

/** The customer form as it is typed, one string per input. */
export type CustomerFormValues = {
  firstName: string;
  familyName: string;
  company: string;
  address: string;
  email: string;
  customerSince: string;
};

/** A blank form for a new customer, dated today. */
export function emptyCustomerForm(): CustomerFormValues {
  return {
    firstName: "",
    familyName: "",
    company: "",
    address: "",
    email: "",
    customerSince: todayIso(),
  };
}

/** The input fields of a customer, shared by adding and editing one. */
export default function CustomerFormFields({
  form,
  onChange,
}: {
  form: CustomerFormValues;
  onChange: (patch: Partial<CustomerFormValues>) => void;
}) {
  return (
    <div className="grid">
      <label>
        First name
        <input
          value={form.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })}
          placeholder="Jane"
          required
        />
      </label>
      <label>
        Family name
        <input
          value={form.familyName}
          onChange={(e) => onChange({ familyName: e.target.value })}
          placeholder="Doe"
          required
        />
      </label>
      <label>
        Company
        <input
          value={form.company}
          onChange={(e) => onChange({ company: e.target.value })}
          placeholder="Acme Trading GmbH"
          required
        />
      </label>
      <label>
        E-mail address
        <input
          type="email"
          value={form.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="jane.doe@acme.example"
          required
        />
      </label>
      <label>
        Customer since
        <input
          type="date"
          value={form.customerSince}
          onChange={(e) => onChange({ customerSince: e.target.value })}
          required
        />
      </label>
      <label className="full">
        Address
        <textarea
          value={form.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder={"Musterstrasse 1\n10115 Berlin"}
          rows={2}
          required
        />
      </label>
    </div>
  );
}
