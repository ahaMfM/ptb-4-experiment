import type { ReactNode } from "react";

/**
 * A dialog on top of the page. Every modal in the application goes through
 * here, so they all dismiss the same way (clicking the backdrop, never a click
 * inside) and all announce themselves the same way to screen readers.
 *
 * The caller supplies the contents and gets told when to close; it never sees
 * the backdrop or the dismiss rule.
 */
export default function Modal({
  /** Announced as the dialog's name, e.g. "Edit customer". */
  label,
  /** Use "alertdialog" when the dialog asks to confirm something. */
  role = "dialog",
  /** Wide layout, for dialogs that show a table. */
  wide = false,
  onClose,
  children,
}: {
  label: string;
  role?: "dialog" | "alertdialog";
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={wide ? "modal modal-wide card" : "modal card"}
        role={role}
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
