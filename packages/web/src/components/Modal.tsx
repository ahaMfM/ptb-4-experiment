import type { ReactNode } from "react";

/**
 * A dialog on top of the page. Clicking the backdrop next to it closes it,
 * which is how every dialog in the application behaves.
 */
export default function Modal({
  ariaLabel,
  role = "dialog",
  wide = false,
  onClose,
  children,
}: {
  ariaLabel: string;
  /** "alertdialog" for the ones asking to confirm something irreversible. */
  role?: "dialog" | "alertdialog";
  /** Wider box, for dialogs that show a table. */
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
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>
  );
}
