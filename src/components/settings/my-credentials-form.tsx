"use client";

import { useActionState } from "react";
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import {
  updateOwnCredentials,
  type ActionState,
} from "@/lib/settings/actions";

const initialState: ActionState = { error: null };

export function MyCredentialsForm({
  currentUsername,
}: {
  currentUsername: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateOwnCredentials,
    initialState,
  );

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Field label="Username" error={state.fieldErrors?.username}>
        <input
          name="username"
          required
          defaultValue={currentUsername}
          className={inputClassName}
        />
      </Field>

      <Field
        label="New password (optional)"
        error={state.fieldErrors?.newPassword}
      >
        <input
          name="newPassword"
          type="password"
          minLength={6}
          placeholder="Leave blank to keep the current password"
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
        {isPending ? "Saving…" : "Save my login"}
      </button>
    </form>
  );
}
