import type { CustomerRecord } from "server/router";
import { toCsv } from "../lib/export";

/**
 * Turn a customer list into a CSV file with every stored field, e.g. to
 * hand the complete customer data to the accountant.
 */
export function customersToCsv(customers: CustomerRecord[]): string {
  return toCsv(
    [
      "ID",
      "Contact person",
      "Company",
      "Address",
      "E-mail",
      "VAT number",
      "Customer since",
      "Recorded by",
      "Recorded at",
    ],
    customers.map((customer) => [
      customer.id,
      customer.contactName,
      customer.company,
      customer.address,
      customer.email,
      customer.vatNumber ?? "",
      customer.customerSince,
      // Empty for entries from before we tracked who recorded what.
      customer.recordedBy ?? "",
      customer.createdAt ?? "",
    ]),
  );
}
