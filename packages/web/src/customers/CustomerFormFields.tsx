import { todayIso } from "../lib/format";

/** The customer form as it is typed, one string per input. */
export type CustomerFormValues = {
  contactName: string;
  company: string;
  address: string;
  email: string;
  vatNumber: string;
  customerSince: string;
};

/** A blank form for a new customer, dated today. */
export function emptyCustomerForm(): CustomerFormValues {
  return {
    contactName: "",
    company: "",
    address: "",
    email: "",
    vatNumber: "",
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
        Contact person
        <input
          value={form.contactName}
          onChange={(e) => onChange({ contactName: e.target.value })}
          placeholder="Jane Doe"
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
        VAT number
        <input
          value={form.vatNumber}
          onChange={(e) => onChange({ vatNumber: e.target.value })}
          placeholder="Optional"
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
