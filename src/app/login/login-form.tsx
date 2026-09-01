"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";
import {
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { CheckIcon } from "@/components/shell/nav-icons";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          {/* login-field-label: Phase 14's glass card bumps this to
              --ink-secondary while its enhancement is active (see
              globals.css) -- --ink-muted, the default here, measures
              short of 4.5:1 against the wave background's darkest
              extreme. Fallback/reduced-transparency/reduced-contrast
              states keep this exact --ink-muted, unaffected. */}
          <label htmlFor="username" className="login-field-label text-xs text-ink-muted">
            Username
          </label>
          {state.fieldErrors?.username ? (
            <span className="animate-alert-in text-xs text-attention" role="alert">
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
          className={`h-10 ${inputClassName} rounded-field!`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="password" className="login-field-label text-xs text-ink-muted">
            Password
          </label>
          {state.fieldErrors?.password ? (
            <span className="animate-alert-in text-xs text-attention" role="alert">
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
          className={`h-10 ${inputClassName} rounded-field!`}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* appearance-none + peer-checked drives the check mark's own fade+
            scale-in -- same restrained, ~150ms convention as every other
            transition in the app, no dependency needed for a custom look. */}
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            id="rememberMe"
            name="rememberMe"
            type="checkbox"
            defaultChecked
            className="peer h-4 w-4 shrink-0 appearance-none rounded border border-border bg-surface transition-colors duration-150 checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-accent"
          />
          <CheckIcon
            size={11}
            className="pointer-events-none absolute scale-90 text-surface opacity-0 transition-[opacity,transform] duration-150 peer-checked:scale-100 peer-checked:opacity-100"
          />
        </span>
        <label htmlFor="rememberMe" className="text-sm text-ink-secondary">
          Remember me
        </label>
      </div>

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={`${primaryButtonClassName} rounded-field! flex items-center justify-center gap-2`}
      >
        {isPending ? (
          <>
            {/* Reuses the existing loading-ring pattern (app/(app)/loading.tsx)
                rather than a new spinner — same animation, already has its
                own prefers-reduced-motion rule in globals.css. Sized down
                (h-4/w-4) for inline button use; ring colors swapped to
                border-surface since this sits on the dark --accent button,
                not the light canvas the page-loading version sits on. */}
            <span
              aria-hidden="true"
              className="animate-loading-ring h-4 w-4 rounded-full border-2 border-surface/30 border-t-surface"
            />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
