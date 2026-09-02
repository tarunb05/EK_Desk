"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Checkbox } from "@/components/forms/checkbox";
import { updateBranch, type ActionState } from "@/lib/settings/actions";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";

const initialState: ActionState = { error: null };

// Same edit-in-place shape as TeacherRow/AcademicYearRow.
export function BranchRow({ branch }: { branch: BranchOption }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateBranch,
    initialState,
  );

  useEffect(() => {
    if (state !== initialState && !state.error) {
      setEditing(false);
    }
  }, [state]);

  if (editing) {
    return (
      <li className="py-3">
        <form action={formAction} noValidate className="flex flex-col gap-3">
          <input type="hidden" name="branchId" value={branch.id} />

          <Field label="Code" error={state.fieldErrors?.code}>
            <input
              name="code"
              required
              defaultValue={branch.code}
              className={inputClassName}
            />
          </Field>

          <Field label="Name" error={state.fieldErrors?.name}>
            <input
              name="name"
              required
              defaultValue={branch.name}
              className={inputClassName}
            />
          </Field>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`isActive-${branch.id}`}
              name="isActive"
              defaultChecked={branch.isActive}
            />
            <label
              htmlFor={`isActive-${branch.id}`}
              className="text-sm text-ink-secondary"
            >
              Active
            </label>
          </div>

          <FormError error={state.error} />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className={`${primaryButtonClassName} h-8 w-24 px-3 text-xs`}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-8 w-24 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <span className="text-ink">{branch.name}</span>
      <div className="flex items-center gap-2">
        {branch.isActive ? null : (
          <span className="rounded-md bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Inactive
          </span>
        )}
        <span className="text-ink-muted">{branch.code}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
        >
          Edit
        </button>
      </div>
    </li>
  );
}
