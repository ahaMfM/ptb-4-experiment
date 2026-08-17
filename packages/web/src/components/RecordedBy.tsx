import { formatDateTime } from "../lib/format";

/**
 * Who recorded an order or customer, and when: the person's name with the
 * day and time underneath. Unknown for entries from before everyone signed
 * in, which show an em dash instead.
 */
export default function RecordedBy({
  name,
  at,
}: {
  name: string | null;
  at: string | null;
}) {
  if (!name) {
    return <span className="muted">—</span>;
  }
  return (
    <>
      {name}
      {at && (
        <>
          <br />
          <span className="muted">{formatDateTime(at)}</span>
        </>
      )}
    </>
  );
}
