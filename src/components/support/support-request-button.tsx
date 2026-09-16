"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormError, primaryButtonClassName } from "@/components/forms/field";
import { SupportIcon } from "@/components/shell/nav-icons";
import { useToast } from "@/components/shell/toast-context";
import {
  submitSupportRequest,
  type SupportActionState,
} from "@/lib/support/actions";

const initialState: SupportActionState = { error: null };

const textareaClassName =
  "w-full min-h-[7rem] resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

// A quick-access way to reach an admin from wherever a teacher already is,
// not a nav destination -- living in TopBar (present on every (app) page)
// rather than only on /support means she never has to leave what she's
// doing just to ask a question about it. /support itself is where she'd
// go to see whether it's been resolved.
export function SupportRequestButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
      >
        <SupportIcon size={14} />
        Support
      </button>

      {/* Mounted only while open, not just visually toggled -- useActionState's
          state lives on this instance, and unmounting on close is what makes a
          second open start from a truly blank form/initialState instead of
          replaying the previous submission's "submitted" state and
          auto-closing itself before the teacher can type anything. */}
      {open ? <SupportRequestDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SupportRequestDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(
    submitSupportRequest,
    initialState,
  );
  const { showToast } = useToast();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Calls onClose() directly rather than relying solely on the dialog's
  // own onClose prop (the native "close" event) to unmount this component
  // -- nothing else in this codebase's only other dialog (DeleteConfirmDialog)
  // actually passes onClose to it, so that round trip through React had
  // never been exercised here before. It silently did not flip the
  // parent's `open` state back to false: the dialog closed at the DOM
  // level (dialogRef.current.close()) but the parent never re-rendered, so
  // a second click on the Support button was a no-op (setOpen(true) when
  // it's already true) and nothing reopened.
  useEffect(() => {
    if (state !== initialState && !state.error && state.submitted) {
      showToast("Support request sent.");
      dialogRef.current?.close();
      onClose();
    }
  }, [state, showToast, onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="support-request-title"
      className="w-full max-w-sm rounded-md border border-border bg-surface p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop:bg-ink/30"
    >
      <form action={formAction} noValidate className="flex flex-col gap-3 p-5">
        <h2 id="support-request-title" className="text-base font-medium text-ink">
          Reach out to an admin
        </h2>
        <p className="text-sm text-ink-secondary">
          Describe what you need help with. An admin will see this on their
          Support page.
        </p>
        <textarea
          name="message"
          required
          autoFocus
          placeholder="What do you need help with?"
          className={textareaClassName}
        />
        <FormError error={state.fieldErrors?.message ?? state.error} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
            className="h-9 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={`${primaryButtonClassName} h-9 px-3 text-sm`}
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
