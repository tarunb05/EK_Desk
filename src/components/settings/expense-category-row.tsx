"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
  dangerButtonClassName,
} from "@/components/forms/field";
import { formatPaise } from "@/lib/domain/money";
import {
  deleteExpenseCategory,
  renameExpenseCategory,
  reorderExpenseCategory,
  setExpenseCategoryActive,
  type ActionState,
} from "@/lib/settings/actions";
import type { ExpenseCategoryWithStats } from "@/lib/settings/queries";

const initialState: ActionState = { error: null };

const rowButtonClassName =
  "h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-secondary";

export function ExpenseCategoryRow({
  category,
  isFirst,
  isLast,
}: {
  category: ExpenseCategoryWithStats;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [renameState, renameAction, renamePending] = useActionState(
    renameExpenseCategory,
    initialState,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setExpenseCategoryActive,
    initialState,
  );
  const [reorderState, reorderAction, reorderPending] = useActionState(
    reorderExpenseCategory,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteExpenseCategory,
    initialState,
  );

  // Same reference-inequality trick used throughout Settings: the initial
  // state and a successful action's return are both { error: null } by
  // shape but different objects, which is what tells "just saved" apart
  // from "never submitted" since ActionState carries no success flag.
  useEffect(() => {
    if (renameState !== initialState && !renameState.error) {
      setEditing(false);
    }
  }, [renameState]);

  if (editing) {
    return (
      <li className="py-3">
        <form action={renameAction} noValidate className="flex flex-col gap-2">
          <input type="hidden" name="categoryId" value={category.id} />
          <Field label="Category name" error={renameState.fieldErrors?.name}>
            <input
              name="name"
              required
              defaultValue={category.name}
              className={inputClassName}
            />
          </Field>
          <p className="text-2xs text-ink-muted">
            Renaming updates every past expense to show the new name.
          </p>
          <FormError error={renameState.error} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={renamePending}
              className={`${primaryButtonClassName} h-8 px-3 text-xs`}
            >
              {renamePending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-ink">{category.name}</span>
          {category.isActive ? null : (
            <span className="rounded-md bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
              Inactive
            </span>
          )}
        </div>

        {deleting ? (
          <form action={deleteAction} className="flex items-center gap-2">
            <input type="hidden" name="categoryId" value={category.id} />
            <span className="text-2xs text-ink-secondary">Delete category?</span>
            <button
              type="submit"
              disabled={deletePending}
              className={`${dangerButtonClassName} h-7 px-2 text-2xs`}
            >
              {deletePending ? "Deleting…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setDeleting(false)}
              className={rowButtonClassName}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5">
            <form action={reorderAction}>
              <input type="hidden" name="categoryId" value={category.id} />
              <input type="hidden" name="direction" value="up" />
              <button
                type="submit"
                disabled={isFirst || reorderPending}
                aria-label={`Move ${category.name} up`}
                className={rowButtonClassName}
              >
                ↑
              </button>
            </form>
            <form action={reorderAction}>
              <input type="hidden" name="categoryId" value={category.id} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                disabled={isLast || reorderPending}
                aria-label={`Move ${category.name} down`}
                className={rowButtonClassName}
              >
                ↓
              </button>
            </form>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className={rowButtonClassName}
            >
              Rename
            </button>

            {category.expenseCount > 0 ? (
              <form action={activeAction}>
                <input type="hidden" name="categoryId" value={category.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={category.isActive ? "false" : "true"}
                />
                <button
                  type="submit"
                  disabled={activePending}
                  className={rowButtonClassName}
                >
                  {category.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setDeleting(true)}
                className={rowButtonClassName}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <span className="text-2xs text-ink-muted">
        {category.expenseCount} expense{category.expenseCount === 1 ? "" : "s"}{" "}
        · {formatPaise(category.totalSpentPaise)} total
      </span>

      <FormError error={activeState.error} />
      <FormError error={reorderState.error} />
      <FormError error={deleteState.error} />
    </li>
  );
}
