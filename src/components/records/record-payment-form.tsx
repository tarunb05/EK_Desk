"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { type ActionState, recordPayment } from "@/lib/records/actions";

const initialState: ActionState = { error: null };

const METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank transfer" },
];

export function RecordPaymentForm({ feeAccountId }: { feeAccountId: string }) {
  const [state, formAction, isPending] = useActionState(
    recordPayment,
    initialState,
  );
  const [method, setMethod] = useState("cash");

  if (state.submitted) {
    return (
      <p className="text-sm text-ink">
        Submitted for approval. An admin will review this payment before
        it&apos;s recorded.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="feeAccountId" value={feeAccountId} />

      <Field label="Amount (₹)" error={state.fieldErrors?.amount}>
        <input
          name="amount"
          type="number"
          min="0"
          step="1"
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Paid on" error={state.fieldErrors?.paidOn}>
        <input name="paidOn" type="date" required className={inputClassName} />
      </Field>

      <Field label="Method" error={state.fieldErrors?.method}>
        <Select
          name="method"
          ariaLabel="Method"
          value={method}
          onChange={setMethod}
          options={METHOD_OPTIONS}
        />
      </Field>

      <Field label="Reference (optional)">
        <input name="reference" className={inputClassName} />
      </Field>

      <Field label="Note (optional)">
        <input name="note" className={inputClassName} />
      </Field>

      <Field label="Recorded by" error={state.fieldErrors?.recordedBy}>
        <input name="recordedBy" required className={inputClassName} />
      </Field>

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClassName}
      >
        {isPending ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}
