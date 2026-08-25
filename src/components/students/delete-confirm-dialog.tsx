"use client";

import { dangerButtonClassName, primaryButtonClassName } from "@/components/forms/field";

// A real in-page dialog, not window.confirm() -- native confirm()/alert()
// render as unstyled OS chrome with no way to match the app's own design
// system. <dialog>.showModal() gets the same focus-trapping and backdrop
// for free, styled like everything else here. Reused for both the admin's
// immediate, irreversible delete and the teacher's request-for-approval --
// same shape, different copy and confirm-button color (destructive vs.
// a plain submit).
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
      className="w-full max-w-sm rounded-md border border-border bg-surface p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop:bg-ink/30"
    >
      <div className="p-5">
        <h2 className="mb-2 text-base font-medium text-ink">{title}</h2>
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
    </dialog>
  );
}
