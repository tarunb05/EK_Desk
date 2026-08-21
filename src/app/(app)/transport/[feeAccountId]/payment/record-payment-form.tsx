"use client";

import { useActionState } from "react";
import { Field, inputClassName } from "@/components/forms/field";
import { type ActionState, recordPayment } from "@/lib/records/actions";

const initialState: ActionState = { error: null };

export function RecordPaymentForm({ feeAccountId }: { feeAccountId: string }) {
  const [state, formAction, isPending] = useActionState(
    recordPayment,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="feeAccountId" value={feeAccountId} />

      <Field label="Amount (₹)">
        <input
          name="amount"
          type="number"
          min="0"
          step="1"
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Paid on">
        <input name="paidOn" type="date" required className={inputClassName} />
      </Field>

      <Field label="Method">
        <select name="method" required className={inputClassName}>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="cheque">Cheque</option>
          <option value="bank_transfer">Bank transfer</option>
        </select>
      </Field>

      <Field label="Reference (optional)">
        <input name="reference" className={inputClassName} />
      </Field>

      <Field label="Note (optional)">
        <input name="note" className={inputClassName} />
      </Field>

      <Field label="Recorded by">
        <input name="recordedBy" required className={inputClassName} />
      </Field>

      {state.error ? (
        <p className="text-xs text-attention" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-md bg-accent text-sm font-medium text-surface transition-colors duration-150 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}
