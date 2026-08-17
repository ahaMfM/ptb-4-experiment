import type { CustomerRecord } from "server/router";
import { downloadCsv } from "../../lib/csv";
import { todayUtc } from "../../lib/format";

/**
 * Hand the complete customer data to somebody outside the application, e.g.
 * the accountant: every customer with every stored field, dates left as they
 * are stored so a spreadsheet can sort and filter on them.
 */
export function downloadCustomersCsv(list: readonly CustomerRecord[]): void {
  downloadCsv(
    `customers-${todayUtc()}.csv`,
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
    list.map((c) => [
      c.id,
      c.contactName,
      c.company,
      c.address,
      c.email,
      c.vatNumber ?? "",
      c.customerSince,
      // Empty for entries from before we tracked who recorded what.
      c.recordedBy ?? "",
      c.createdAt ?? "",
    ]),
  );
}
