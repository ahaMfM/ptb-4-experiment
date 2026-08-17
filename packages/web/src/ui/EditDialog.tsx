import type { FormEvent, ReactNode } from "react";
import Modal from "./Modal";

/**
 * A dialog that edits one record. Callers bring the fields and the saving;
 * the frame around them — the form, "Save changes"/"Saving…", Cancel, and
 * where a failed save is reported — is the same everywhere and lives here.
 */
export default function EditDialog({
  /** Announced as the dialog's name, e.g. "Edit customer". */
  label,
  title,
  /** The form fields. */
  children,
  isPending,
  /** Shown above the buttons; the dialog stays open so the input is not lost. */
  error,
  onSubmit,
  onClose,
}: {
  label: string;
  title: string;
  children: ReactNode;
  isPending: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <Modal label={label} onClose={onClose}>
      <h2>{title}</h2>
      <form onSubmit={onSubmit}>
        {children}
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
