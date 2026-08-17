import { readableError } from "../lib/errors";

/**
 * While a query is loading, and if it fails, say so. Renders nothing once
 * the data has arrived — what to do with it is the caller's business.
 */
export default function QueryFeedback({
  query,
  errorPrefix,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    error: { message: string } | null;
  };
  /** Names what could not be loaded, e.g. "Could not load customers". */
  errorPrefix?: string;
}) {
  if (query.isLoading) {
    return <p className="muted">Loading…</p>;
  }
  if (query.isError) {
    const message = readableError(query.error?.message ?? "");
    return (
      <p className="error">
        {errorPrefix ? `${errorPrefix}: ${message}` : message}
      </p>
    );
  }
  return null;
}
