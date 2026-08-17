import { formatDateTime } from "../lib/format";

/**
 * Who recorded something and when, shown the same way everywhere it
 * appears: the name followed by the day and time. Entries from before
 * everyone signed in have no name, so we show an em dash instead.
 */
export default function RecordedBy({
  who,
  when,
}: {
  who: string | null | undefined;
  when: string | null | undefined;
}) {
  if (!who) {
    return <span className="muted">—</span>;
  }
  return (
    <>
      {who}
      {when && <span className="muted"> on {formatDateTime(when)}</span>}
    </>
  );
}
