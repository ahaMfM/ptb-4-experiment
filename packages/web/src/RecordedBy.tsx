import { formatDateTime } from "./utils";

/** Who recorded something and when: name plus the day and time, everywhere it's shown. */
export default function RecordedBy({
  recordedBy,
  createdAt,
}: {
  recordedBy: string | null;
  createdAt: string | null;
}) {
  if (!recordedBy) return <span className="muted">—</span>;
  return (
    <>
      {recordedBy}
      {createdAt && <span className="muted"> · {formatDateTime(createdAt)}</span>}
    </>
  );
}
