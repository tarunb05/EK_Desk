"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { DateField } from "@/components/forms/date-field";
import { Checkbox } from "@/components/forms/checkbox";
import { updateAcademicYear, type ActionState } from "@/lib/settings/actions";
import type { AcademicYearOption } from "@/lib/shell/resolve-year-branch";

const initialState: ActionState = { error: null };

// Same edit-in-place shape as TeacherRow: the list item itself swaps
// between a read view and its own form, rather than a separate modal.
export function AcademicYearRow({ year }: { year: AcademicYearOption }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateAcademicYear,
    initialState,
  );

  // Reference inequality (not an explicit success flag) is what tells a
  // fresh initial state apart from "the action just returned with no
  // error" -- same trick TeacherRow's update form uses.
  useEffect(() => {
    if (state !== initialState && !state.error) {
      setEditing(false);
    }
  }, [state]);

  if (editing) {
    return (
      <li className="py-3">
        <form action={formAction} noValidate className="flex flex-col gap-3">
          <input type="hidden" name="yearId" value={year.id} />

          <Field label="Label" error={state.fieldErrors?.label}>
            <input
              name="label"
              required
              defaultValue={year.label}
              className={inputClassName}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts on" error={state.fieldErrors?.startsOn}>
              <DateField
                name="startsOn"
                required
                ariaLabel="Starts on"
                defaultValue={year.startsOn}
              />
            </Field>
            <Field label="Ends on" error={state.fieldErrors?.endsOn}>
              <DateField
                name="endsOn"
                required
                ariaLabel="Ends on"
                defaultValue={year.endsOn}
              />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`isCurrent-${year.id}`}
              name="isCurrent"
              defaultChecked={year.isCurrent}
            />
            <label
              htmlFor={`isCurrent-${year.id}`}
              className="text-sm text-ink-secondary"
            >
              Make this the current year
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
      <span className="text-ink">{year.label}</span>
      <div className="flex items-center gap-2">
        {year.isCurrent ? (
          <span className="rounded-md bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-accent">
            Current
          </span>
        ) : null}
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
