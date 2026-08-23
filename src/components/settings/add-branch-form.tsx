"use client";

import { useActionState } from "react";
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { createBranch, type ActionState } from "@/lib/settings/actions";

const initialState: ActionState = { error: null };

export function AddBranchForm() {
  const [state, formAction, isPending] = useActionState(
    createBranch,
    initialState,
  );

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 border-t border-hairline pt-4"
    >
      <Field label="Code" error={state.fieldErrors?.code}>
        <input
          name="code"
          required
          placeholder="BR-C"
          className={inputClassName}
        />
      </Field>

      <Field label="Name" error={state.fieldErrors?.name}>
        <input
          name="name"
          required
          placeholder="Whitefield"
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
        {isPending ? "Saving…" : "Add branch"}
      </button>
    </form>
  );
}
