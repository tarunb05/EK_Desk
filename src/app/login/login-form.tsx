"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";
import {
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="username" className="text-xs text-ink-muted">
            Username
          </label>
          {state.fieldErrors?.username ? (
            <span className="text-xs text-attention" role="alert">
              {state.fieldErrors.username}
            </span>
          ) : null}
        </div>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className={`h-10 ${inputClassName}`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="password" className="text-xs text-ink-muted">
            Password
          </label>
          {state.fieldErrors?.password ? (
            <span className="text-xs text-attention" role="alert">
              {state.fieldErrors.password}
            </span>
          ) : null}
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`h-10 ${inputClassName}`}
        />
      </div>

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
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
