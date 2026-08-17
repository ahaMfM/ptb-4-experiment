/**
 * Handing a table to the user as a spreadsheet file.
 *
 * Callers pass a header row and data rows and get a download; the quoting
 * rules, the encoding and the browser trickery below stay in here.
 */

/**
 * Build an RFC 4180 CSV document from a header row and data rows.
 * Fields containing quotes, commas, or line breaks are quoted, so
 * multi-line values like postal addresses survive the round trip.
 * Rows end in CRLF, which Excel expects.
 */
function toCsv(header: readonly string[], rows: readonly (string | number)[][]): string {
  const escapeField = (field: string | number): string => {
    const text = String(field);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows]
    .map((row) => row.map(escapeField).join(","))
    .join("\r\n");
}

/** Offer the table as a CSV file named `filename`, ready to open in Excel. */
export function downloadCsv(
  filename: string,
  header: readonly string[],
  rows: readonly (string | number)[][],
): void {
  // The BOM makes Excel detect UTF-8, so umlauts in names survive.
  const blob = new Blob(["\uFEFF", toCsv(header, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
