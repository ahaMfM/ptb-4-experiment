import type { ReactNode } from "react";
import Modal from "./Modal";

/**
 * Asks whether something should really be deleted. The caller runs the
 * deletion itself and reports back how it is going through `pending` and
 * `error`, so the dialog stays open while the server is asked.
 */
export default function ConfirmDeleteDialog({
  ariaLabel,
  heading,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
  children,
}: {
  ariaLabel: string;
  heading: string;
  /** Label of the confirming button, e.g. "Delete customer". */
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  /** What exactly will be deleted, and that it cannot be undone. */
  children: ReactNode;
}) {
  return (
    <Modal ariaLabel={ariaLabel} role="alertdialog" onClose={onClose}>
      <h2>{heading}</h2>
      <p>{children}</p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button
          type="button"
          className="danger"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Deleting…" : confirmLabel}
        </button>
        <button type="button" className="secondary" onClick={onClose} autoFocus>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
