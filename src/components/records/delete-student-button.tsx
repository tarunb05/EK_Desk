"use client";

import { useActionState } from "react";
import { archiveStudent, type ActionState } from "@/lib/records/actions";

const initialState: ActionState = { error: null };

export function DeleteStudentButton({
  studentId,
  studentName,
  redirectTo,
}: {
  studentId: string;
  studentName: string;
  redirectTo: "/transport" | "/daycare";
}) {
  const [state, formAction, isPending] = useActionState(
    archiveStudent,
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete ${studentName}? They'll be removed from every dashboard and record table, but their fee and payment history is kept.`,
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state.error ? (
        <p className="mb-2 text-xs text-attention" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-8 rounded-md border border-border px-3 text-xs text-attention transition-colors duration-150 hover:bg-surface-accent disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete student"}
      </button>
    </form>
  );
}
