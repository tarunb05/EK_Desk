"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import {
  createCollectionAccount,
  updateCollectionAccount,
  type AffectedPaymentRequest,
  type CollectionAccountActionState,
} from "@/lib/settings/collection-account-actions";
import type { CollectionAccountRow } from "@/lib/settings/queries";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";

const initialState: CollectionAccountActionState = { error: null };

const SERVICE_LABEL: Record<string, string> = {
  transport: "Transport",
  daycare: "Daycare",
};

function AffectedRequestsNotice({
  affected,
}: {
  affected: AffectedPaymentRequest[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-attention bg-attention-fill/20 p-3 text-sm">
      <p className="text-ink">
        This account&apos;s details changed, so the open payment link(s)
        below no longer match what&apos;s shown on them. They&apos;ve been
        cancelled automatically — re-send a new one to each student when
        Phase 15.3 adds that.
      </p>
      <ul className="flex flex-col gap-1 text-2xs text-ink-secondary">
        {affected.map((item) => (
          <li key={`${item.admissionNo}-${item.serviceType}`}>
            {item.studentName} ({item.admissionNo}) —{" "}
            {SERVICE_LABEL[item.serviceType] ?? item.serviceType}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shared by the "add" form and each row's "edit" form -- same fields either
// way, just a different action and a hidden accountId on edit. Re-entering
// the current password is required on every save (Phase 15.2's
// re-authentication, checked server-side via verify_current_password), not
// just once per session, since this is the screen the brief calls the
// highest-risk one in the app.
export function CollectionAccountForm({
  branches,
  account,
  onSaved,
  onCancel,
}: {
  branches: BranchOption[];
  account?: CollectionAccountRow;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const action = account ? updateCollectionAccount : createCollectionAccount;
  const [state, formAction, isPending] = useActionState(
    action,
    initialState,
  );
  const [branchId, setBranchId] = useState(
    account?.branchId ?? branches[0]?.id ?? "",
  );

  // A successful save with no cascade-cancel closes the form (create) or
  // exits edit mode (edit); one that DID cancel requests stays open so the
  // affected list stays visible instead of vanishing the instant it renders.
  if (state !== initialState && !state.error && !state.affected) {
    onSaved?.();
  }

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 border-t border-hairline pt-4"
    >
      {account ? (
        <input type="hidden" name="accountId" value={account.id} />
      ) : null}

      <Field label="Branch" error={state.fieldErrors?.branchId}>
        <Select
          name="branchId"
          ariaLabel="Branch"
          value={branchId}
          onChange={setBranchId}
          options={branches.map((branch) => ({
            value: branch.id,
            label: branch.name,
          }))}
        />
      </Field>

      <Field label="Label" error={state.fieldErrors?.label}>
        <input
          name="label"
          required
          placeholder="Main"
          defaultValue={account?.label}
          className={inputClassName}
        />
      </Field>

      <Field label="Payee name (shown to parents)" error={state.fieldErrors?.payeeName}>
        <input
          name="payeeName"
          required
          defaultValue={account?.payeeName}
          className={inputClassName}
        />
      </Field>

      <Field label="UPI ID" error={state.fieldErrors?.upiId}>
        <input
          name="upiId"
          placeholder="school@upi"
          defaultValue={account?.upiId ?? ""}
          className={inputClassName}
        />
      </Field>

      <Field label="Bank name" error={state.fieldErrors?.bankName}>
        <input
          name="bankName"
          defaultValue={account?.bankName ?? ""}
          className={inputClassName}
        />
      </Field>

      <Field label="Account holder" error={state.fieldErrors?.accountHolder}>
        <input
          name="accountHolder"
          defaultValue={account?.accountHolder ?? ""}
          className={inputClassName}
        />
      </Field>

      <Field label="Account number" error={state.fieldErrors?.accountNumber}>
        <input
          name="accountNumber"
          inputMode="numeric"
          defaultValue={account?.accountNumber ?? ""}
          className={inputClassName}
        />
      </Field>

      <Field
        label="Confirm account number"
        error={state.fieldErrors?.confirmAccountNumber}
      >
        <input
          name="confirmAccountNumber"
          inputMode="numeric"
          defaultValue={account?.accountNumber ?? ""}
          className={inputClassName}
        />
      </Field>

      <Field label="IFSC" error={state.fieldErrors?.ifsc}>
        <input
          name="ifsc"
          placeholder="HDFC0001234"
          defaultValue={account?.ifsc ?? ""}
          className={inputClassName}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={account?.isActive ?? true}
          className="h-4 w-4"
        />
        Active — offered as a destination for new payment requests
      </label>

      <Field
        label="Your password (to confirm this change)"
        error={state.fieldErrors?.currentPassword}
      >
        <input
          name="currentPassword"
          type="password"
          required
          className={inputClassName}
        />
      </Field>

      <FormError error={state.error} />
      {state.affected ? (
        <AffectedRequestsNotice affected={state.affected} />
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={primaryButtonClassName}
        >
          {isPending ? "Saving…" : account ? "Save" : "Add collection account"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
