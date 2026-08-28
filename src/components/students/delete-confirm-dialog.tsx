"use client";

import { dangerButtonClassName, primaryButtonClassName } from "@/components/forms/field";
import { AlertIcon } from "@/components/shell/nav-icons";

// A real in-page dialog, not window.confirm() -- native confirm()/alert()
// render as unstyled OS chrome with no way to match the app's own design
// system. <dialog>.showModal() gets the same focus-trapping and backdrop
// for free, styled like everything else here. Reused for both the admin's
// immediate, irreversible delete and the teacher's request-for-approval --
// same shape, different copy and confirm-button color (destructive vs.
// a plain submit); the icon badge follows the same flag so a non-destructive
// confirmation (nothing currently passes destructive={false}, but the prop
// exists for it) doesn't get a false warning triangle.
export function DeleteConfirmDialog({
  dialogRef,
  title,
  message,
  confirmLabel,
  destructive = true,
  onConfirm,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose?: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="delete-confirm-title"
      className="w-full max-w-sm rounded-md border border-border bg-surface p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop:bg-ink/30"
    >
      <div className="flex gap-3 p-5">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            destructive
              ? "bg-attention-fill text-attention"
              : "bg-surface-accent text-accent"
          }`}
        >
          <AlertIcon size={18} />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 id="delete-confirm-title" className="mb-1 text-base font-medium text-ink">
            {title}
          </h2>
          <p className="mb-4 text-sm text-ink-secondary">{message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="h-9 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
                onConfirm();
              }}
              className={`${destructive ? dangerButtonClassName : primaryButtonClassName} px-3 text-sm`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
