"use client";

import { useActionState } from "react";
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { createAcademicYear, type ActionState } from "@/lib/settings/actions";

const initialState: ActionState = { error: null };

export function AddAcademicYearForm() {
  const [state, formAction, isPending] = useActionState(
    createAcademicYear,
    initialState,
  );

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 border-t border-hairline pt-4"
    >
      <Field label="Label" error={state.fieldErrors?.label}>
        <input
          name="label"
          required
          placeholder="2027-2028"
          className={inputClassName}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts on" error={state.fieldErrors?.startsOn}>
          <input
            name="startsOn"
            type="date"
            required
            className={inputClassName}
          />
        </Field>
        <Field label="Ends on" error={state.fieldErrors?.endsOn}>
          <input
            name="endsOn"
            type="date"
            required
            className={inputClassName}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          name="isCurrent"
          className="h-4 w-4 rounded border-border"
        />
        Make this the current year
      </label>

      {state.error ? (
        <p className="text-xs text-attention" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClassName}
      >
        {isPending ? "Saving…" : "Add academic year"}
      </button>
    </form>
  );
}
