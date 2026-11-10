"use client";

import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/domain/money";
import { useActionState, useState } from "react";
import { useFocusFirstError } from "@/components/forms/use-focus-first-error";
import { useUnsavedChangesWarning } from "@/components/forms/use-unsaved-changes-warning";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { DateField } from "@/components/forms/date-field";
import { type ActionState, recordPayment } from "@/lib/records/actions";

const initialState: ActionState = { error: null };

export const METHOD_OPTIONS = PAYMENT_METHODS.map((value) => ({
  value,
  label: METHOD_LABELS[value],
}));

export function RecordPaymentForm({ feeAccountId }: { feeAccountId: string }) {
  const [state, formAction, isPending] = useActionState(
    recordPayment,
    initialState,
  );
  const formRef = useFocusFirstError(state.fieldErrors);
  useUnsavedChangesWarning(formRef, isPending);
  const [method, setMethod] = useState("cash");

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-4"
    >
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
        <DateField name="paidOn" required ariaLabel="Paid on" />
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
