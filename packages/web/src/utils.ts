import { useCallback, useEffect, useState } from "react";

const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

/** Format a numeric string like "19.90" as a localized EUR amount. */
export function formatPrice(price: string | number): string {
  const value = Number(price);
  return Number.isFinite(value) ? priceFormatter.format(value) : String(price);
}

/** Format a plain date like "2024-05-01" for display, without timezone shifts. */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format an ISO timestamp with date and time for display. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Build an RFC 4180 CSV document from a header row and data rows.
 * Fields containing quotes, commas, or line breaks are quoted, so
 * multi-line values like postal addresses survive the round trip.
 * Rows end in CRLF, which Excel expects.
 */
export function toCsv(
  header: string[],
  rows: (string | number)[][],
): string {
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

/**
 * String state that mirrors a URL query parameter, so a reload keeps the
 * current selection and copying the address bar shares it as-is. The
 * parameter is omitted from the URL while it equals `defaultValue`.
 */
export function useUrlParam(
  name: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const read = () =>
    new URLSearchParams(window.location.search).get(name) ?? defaultValue;

  const [value, setValue] = useState(read);

  useEffect(() => {
    const onPopState = () => setValue(read());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, defaultValue]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) {
        params.delete(name);
      } else {
        params.set(name, next);
      }
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", url);
    },
    [name, defaultValue],
  );

  return [value, update];
}

/** Zod validation errors arrive as a JSON array in the message; show just the texts. */
export function readableError(message: string): string {
  try {
    const issues = JSON.parse(message) as Array<{ message?: string }>;
    if (Array.isArray(issues)) {
      const texts = issues.map((i) => i.message).filter(Boolean);
      if (texts.length > 0) return texts.join(" ");
    }
  } catch {
    // not JSON — fall through
  }
  return message;
}
