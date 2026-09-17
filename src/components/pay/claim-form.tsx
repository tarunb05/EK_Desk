"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import {
  submitPaymentClaim,
  type ClaimActionState,
} from "@/lib/payments/actions";

const initialState: ClaimActionState = { error: null };

// A plain <form action={...}> works without JS at all (the whole point of
// a Server Action) -- useActionState only adds inline pending/error state
// on top of that, same as every other form in this app. The one thing this
// page can't do is a client-side amount/date bound check against the
// request's own creation date (it doesn't have that value) -- those are
// enforced again in submit_payment_claim itself, which does.
export function ClaimForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    submitPaymentClaim,
    initialState,
  );
  const [method, setMethod] = useState<"upi" | "bank">("upi");

  if (state.submitted) {
    return (
      <p className="rounded-md border border-border bg-surface p-4 text-sm text-ink">
        Payment reported. The school will confirm it shortly.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
    >
      <input type="hidden" name="token" value={token} />

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMethod("upi")}
          className={`rounded-md border px-2 py-1 ${
            method === "upi"
              ? "border-accent text-accent"
              : "border-border text-ink-secondary"
          }`}
        >
          Paid by UPI
        </button>
        <button
          type="button"
          onClick={() => setMethod("bank")}
          className={`rounded-md border px-2 py-1 ${
            method === "bank"
              ? "border-accent text-accent"
              : "border-border text-ink-secondary"
          }`}
        >
          Paid by bank transfer
        </button>
      </div>

      <Field
        label={method === "upi" ? "UTR (12-digit UPI reference)" : "Bank reference"}
        error={state.fieldErrors?.utr}
      >
        <input
          name="utr"
          inputMode={method === "upi" ? "numeric" : "text"}
          maxLength={50}
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Amount paid (₹)" error={state.fieldErrors?.amount}>
        <input
          name="amount"
          inputMode="decimal"
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Date paid" error={state.fieldErrors?.paidOn}>
        <input
          name="paidOn"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          required
          className={inputClassName}
        />
      </Field>

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={`${primaryButtonClassName} h-10 text-sm`}
      >
        {isPending ? "Reporting…" : "I've paid"}
      </button>
    </form>
  );
}
