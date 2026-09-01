"use client";

import { useActionState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { createAcademicYear, type ActionState } from "@/lib/settings/actions";
import { DateField } from "@/components/forms/date-field";
import { Checkbox } from "@/components/forms/checkbox";

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
          <DateField name="startsOn" required ariaLabel="Starts on" />
        </Field>
        <Field label="Ends on" error={state.fieldErrors?.endsOn}>
          <DateField name="endsOn" required ariaLabel="Ends on" />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="isCurrent" name="isCurrent" />
        <label htmlFor="isCurrent" className="text-sm text-ink-secondary">
          Make this the current year
        </label>
      </div>

      <FormError error={state.error} />

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
