import type { ReactNode } from "react";
import Modal from "./Modal";

/**
 * "Are you sure?" before something is deleted for good.
 *
 * Every deletion in the application is confirmed the same way: the dialog says
 * what will disappear, the destructive button carries the action, Cancel is
 * focused first so a stray Enter cannot delete anything, and a failed deletion
 * is reported in the dialog instead of closing it. Callers bring the wording
 * and the deletion itself.
 */
export default function ConfirmDeleteDialog({
  /** Announced as the dialog's name, e.g. "Delete customer". */
  label,
  title,
  /** What the deletion means, shown as the dialog's body text. */
  children,
  confirmLabel,
  pendingLabel,
  isPending,
  /** Shown inside the dialog; the dialog stays open. */
  error,
  onConfirm,
  onClose,
}: {
  label: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal label={label} role="alertdialog" onClose={onClose}>
      <h2>{title}</h2>
      <p>{children}</p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button
          type="button"
          className="danger"
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? pendingLabel : confirmLabel}
        </button>
        <button type="button" className="secondary" onClick={onClose} autoFocus>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
