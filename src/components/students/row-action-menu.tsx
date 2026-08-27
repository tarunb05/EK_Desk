"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  permanentlyDeleteStudent,
  requestStudentDelete,
} from "@/lib/records/actions";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { ActionMenu, type ActionMenuItem } from "@/components/shell/action-menu";
import type { Role } from "@/lib/auth/routes";

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

  function openDeleteDialog() {
    setError(null);
    // Deferring past this tick avoids the confirm dialog's showModal()
    // racing the menu's own portal-unmount from the same click -- both
    // want to touch the DOM in the same event, and the dialog needs to
    // win second.
    setTimeout(() => dialogRef.current?.showModal(), 0);
  }

  const items: ActionMenuItem[] = [
    ...(editHref
      ? [{ label: "Edit", onSelect: () => router.push(editHref) }]
      : []),
    ...(paymentHref
      ? [{ label: "Record payment", onSelect: () => router.push(paymentHref) }]
      : []),
    {
      label: role === "admin" ? "Delete permanently" : "Request deletion",
      onSelect: openDeleteDialog,
      destructive: true,
    },
  ];

  return (
    <div className="inline-flex flex-col gap-1">
      <ActionMenu items={items} disabled={isPending} />
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
