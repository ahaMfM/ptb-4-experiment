/** "open" → "Open" — statuses are stored lowercase. */
function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Colored pill showing an order's lifecycle status (open / shipped / cancelled). */
export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status}`}>{formatStatus(status)}</span>
  );
}
