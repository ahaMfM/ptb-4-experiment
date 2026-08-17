/** Reads a query-string parameter from the current URL. */
export function getSearchParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Sets (or clears, when `value` is null) a query-string parameter without
 * adding a history entry, so the URL always reflects the current view and
 * can be reloaded or shared as-is.
 */
export function setSearchParam(name: string, value: string | null): void {
  const params = new URLSearchParams(window.location.search);
  if (value === null) {
    params.delete(name);
  } else {
    params.set(name, value);
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", url);
}
