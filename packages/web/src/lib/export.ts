/**
 * Handing data to the user as a file, e.g. a customer list for the
 * accountant.
 */

/**
 * Build an RFC 4180 CSV document from a header row and data rows.
 * Fields containing quotes, commas, or line breaks are quoted, so
 * multi-line values like postal addresses survive the round trip.
 * Rows end in CRLF, which Excel expects.
 */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const escapeField = (field: string | number): string => {
    const text = String(field);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows]
    .map((row) => row.map(escapeField).join(","))
    .join("\r\n");
}

/** Offer `content` to the user as a file download named `filename`. */
export function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  // The BOM makes Excel detect UTF-8, so umlauts in names survive.
  const blob = new Blob(["\uFEFF", content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
