"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { deleteExpense } from "@/lib/records/actions";
import { DeleteConfirmDialog } from "@/components/students/delete-confirm-dialog";

// Plain "Edit | Delete" links, not a dropdown -- unlike the student
// directory's per-row Actions menu, there are only ever these two, so a
// popover (and the overflow-clipping problem ActionMenu exists to solve)
// isn't a concern here. Admin and teacher (own branch, enforced by RLS)
// both delete directly -- per CLAUDE.md rule 10, an expense creates no
// receivable, so there's no approval queue to route through either way.
export function ExpenseRowActions({ expenseId }: { expenseId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("expenseId", expenseId);
      const result = await deleteExpense({ error: null }, formData);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Link
          href={`/expenses/${expenseId}/edit`}
          className="text-2xs text-accent hover:underline"
        >
          Edit
        </Link>
        <button
          type="button"
          disabled={isPending}
          onClick={() => dialogRef.current?.showModal()}
          className="text-2xs text-attention hover:underline disabled:opacity-60"
        >
          Delete
        </button>
      </div>
      {error ? (
        <span className="text-2xs text-attention" role="alert">
          {error}
        </span>
      ) : null}
      <DeleteConfirmDialog
        dialogRef={dialogRef}
        title="Delete this expense?"
        message="This removes the expense from every total and the category breakdown. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
