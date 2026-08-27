"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpense } from "@/lib/records/actions";
import { DeleteConfirmDialog } from "@/components/students/delete-confirm-dialog";
import { ActionMenu, type ActionMenuItem } from "@/components/shell/action-menu";

// Same Actions-menu pattern as the student directory's RowActionMenu, for
// the same reason: the expense table lives inside an overflow-x-auto
// wrapper too, so a plain absolutely-positioned popover risks the same
// clipping ActionMenu's portal exists to avoid. Admin and teacher (own
// branch, enforced by RLS) both delete directly -- per CLAUDE.md rule 10,
// an expense creates no receivable, so there's no approval queue to route
// through either way.
export function ExpenseRowActions({ expenseId }: { expenseId: string }) {
  const router = useRouter();
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

  function openDeleteDialog() {
    setError(null);
    // Same deferral RowActionMenu uses -- the confirm dialog's showModal()
    // would otherwise race the menu's own portal-unmount from the same
    // click.
    setTimeout(() => dialogRef.current?.showModal(), 0);
  }

  const items: ActionMenuItem[] = [
    { label: "Edit", onSelect: () => router.push(`/expenses/${expenseId}/edit`) },
    { label: "Delete", onSelect: openDeleteDialog, destructive: true },
  ];

  return (
    <div className="inline-flex flex-col gap-1">
      <ActionMenu items={items} disabled={isPending} />
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
