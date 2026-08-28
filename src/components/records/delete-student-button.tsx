"use client";

import { useActionState, useRef } from "react";
import { archiveStudent, type ActionState } from "@/lib/records/actions";
import { FormError } from "@/components/forms/field";
import { DeleteConfirmDialog } from "@/components/students/delete-confirm-dialog";

const initialState: ActionState = { error: null };

// Was window.confirm() -- the one holdout in the app still using unstyled OS
// chrome instead of DeleteConfirmDialog (see that component's own comment
// for why every other delete here avoids it). Confirming submits the same
// form via requestSubmit() rather than duplicating archiveStudent's call.
export function DeleteStudentButton({
  studentId,
  studentName,
  redirectTo,
}: {
  studentId: string;
  studentName: string;
  redirectTo: "/transport" | "/daycare" | "/students";
}) {
  const [state, formAction, isPending] = useActionState(
    archiveStudent,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <form action={formAction} ref={formRef}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <FormError error={state.error} className="mb-2" />

      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={isPending}
        className="h-8 rounded-md border border-border px-3 text-xs text-attention transition-colors duration-150 hover:bg-surface-accent disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete student"}
      </button>

      <DeleteConfirmDialog
        dialogRef={dialogRef}
        title="Delete this student?"
        message={`${studentName} will be removed from every dashboard and record table, but their fee and payment history is kept.`}
        confirmLabel="Delete"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
