/** "open" → "Open" — statuses are stored lowercase. */
function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Colored pill showing a lifecycle status: an order's (open / shipped /
 * cancelled) or an invoice's (paid / unpaid). The colour comes from the
 * `status-<status>` class, so a badge and its styling always agree.
 */
export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status}`}>{formatStatus(status)}</span>
  );
}
