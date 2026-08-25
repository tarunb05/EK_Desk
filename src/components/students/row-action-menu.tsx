"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  permanentlyDeleteStudent,
  requestStudentDelete,
} from "@/lib/records/actions";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import type { Role } from "@/lib/auth/routes";

const selectClassName =
  "h-7 rounded-md border border-border bg-surface px-1.5 text-2xs text-ink-secondary outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60";

const DELETE_VALUE = "__delete";

// A navigation-and-actions menu, not a form control -- Edit/Record payment
// push to that route; the delete option opens the confirm dialog, then
// either deletes directly (admin) or queues an approval request (teacher).
// Admin and teacher get the exact same control; only what happens after
// confirming differs, matching every other action in this app.
export function RowActionMenu({
  editHref,
  paymentHref,
  studentId,
  studentName,
  role,
}: {
  editHref?: string;
  paymentHref?: string;
  studentId: string;
  studentName: string;
  role: Role;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("studentId", studentId);
      const action =
        role === "admin" ? permanentlyDeleteStudent : requestStudentDelete;
      const result = await action({ error: null }, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.submitted) {
        setSubmitted(true);
      }
    });
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <select
        aria-label="Actions"
        defaultValue=""
        disabled={isPending}
        onChange={(event) => {
          const value = event.target.value;
          event.target.value = "";
          setError(null);

          if (value === DELETE_VALUE) {
            // Opening a <dialog> synchronously inside a <select>'s change
            // handler can be swallowed in some browsers -- the native
            // dropdown is still mid-way through closing its own UI at that
            // point. Deferring past this tick avoids the conflict (the same
            // fix window.confirm() needed here before this was replaced).
            setTimeout(() => dialogRef.current?.showModal(), 0);
            return;
          }

          if (value) {
            router.push(value);
          }
        }}
        className={selectClassName}
      >
        <option value="" disabled>
          Actions
        </option>
        {editHref ? <option value={editHref}>Edit</option> : null}
        {paymentHref ? (
          <option value={paymentHref}>Record payment</option>
        ) : null}
        <option value={DELETE_VALUE}>
          {role === "admin" ? "Delete permanently" : "Request deletion"}
        </option>
      </select>
      {error ? (
        <span className="text-2xs text-attention" role="alert">
          {error}
        </span>
      ) : null}
      {submitted ? (
        <span className="text-2xs text-ink-secondary">
          Submitted for admin approval.
        </span>
      ) : null}
      <DeleteConfirmDialog
        dialogRef={dialogRef}
        title={
          role === "admin"
            ? `Delete ${studentName}?`
            : `Request deletion of ${studentName}?`
        }
        message={
          role === "admin"
            ? "This removes the student and every fee account and payment they have from the database. This cannot be undone."
            : "This sends a delete request to an admin for approval. Nothing is removed unless and until they approve it."
        }
        confirmLabel={
          role === "admin" ? "Delete permanently" : "Request deletion"
        }
        destructive={role === "admin"}
        onConfirm={handleDelete}
      />
    </div>
  );
}
