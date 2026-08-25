"use client";

import { useActionState } from "react";
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { createExpenseCategory, type ActionState } from "@/lib/settings/actions";

const initialState: ActionState = { error: null };

export function AddExpenseCategoryForm() {
  const [state, formAction, isPending] = useActionState(
    createExpenseCategory,
    initialState,
  );

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 border-t border-hairline pt-4"
    >
      <Field label="Category name" error={state.fieldErrors?.name}>
        <input
          name="name"
          required
          placeholder="Grocery"
          className={inputClassName}
        />
      </Field>

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
        {isPending ? "Adding…" : "Add category"}
      </button>
    </form>
  );
}
