"use client";

import { useActionState } from "react";
import { useFocusFirstError } from "@/components/forms/use-focus-first-error";
import {
  Field,
  FormError,
  inputClassName,
  dangerButtonClassName,
} from "@/components/forms/field";
import { type ActionState, voidPayment } from "@/lib/records/actions";

const initialState: ActionState = { error: null };

export function VoidPaymentForm({ paymentId }: { paymentId: string }) {
  const [state, formAction, isPending] = useActionState(
    voidPayment,
    initialState,
  );
  const formRef = useFocusFirstError(state.fieldErrors);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:p-6"
    >
      <input type="hidden" name="paymentId" value={paymentId} />

      <Field label="Reason for voiding" error={state.fieldErrors?.voidReason}>
        <input name="voidReason" required className={inputClassName} />
      </Field>

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={dangerButtonClassName}
      >
        {isPending ? "Voiding…" : "Void payment"}
      </button>
    </form>
  );
}
