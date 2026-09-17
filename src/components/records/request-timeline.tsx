"use client";

import { useActionState, useState } from "react";
import { formatPaise } from "@/lib/domain/money";
import { formatLogDate } from "@/lib/domain/datetime";
import type { RequestTimelineEntry } from "@/lib/records/student-detail";
import type { Role } from "@/lib/auth/routes";
import {
  enterAndConfirmClaim,
  type ClaimActionState,
} from "@/lib/claims/actions";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";

const CLOSED_REASON_LABEL: Record<string, string> = {
  paid: "paid",
  pending_cleared: "pending cleared",
  expired: "expired",
  cancelled: "cancelled",
  account_changed: "collection account changed",
  fee_account_changed: "fee account changed",
};

const initialState: ClaimActionState = { error: null };

function EnterClaimForm({ paymentRequestId }: { paymentRequestId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    enterAndConfirmClaim,
    initialState,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-2xs text-accent hover:underline"
      >
        Enter a claim from WhatsApp
      </button>
    );
  }

  return (
    <form
      action={action}
      noValidate
      className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-hairline bg-canvas p-3"
    >
      <input type="hidden" name="paymentRequestId" value={paymentRequestId} />
      <Field label="UTR / reference" error={state.fieldErrors?.utr}>
        <input name="utr" required className={`w-36 ${inputClassName}`} />
      </Field>
      <Field label="Claimed amount (₹)" error={state.fieldErrors?.claimedAmount}>
        <input
          name="claimedAmount"
          inputMode="decimal"
          required
          className={`w-24 ${inputClassName}`}
        />
      </Field>
      <Field label="Claimed date" error={state.fieldErrors?.claimedPaidOn}>
        <input
          name="claimedPaidOn"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          required
          className={inputClassName}
        />
      </Field>
      <Field label="Amount received (₹)" error={state.fieldErrors?.amount}>
        <input
          name="amount"
          inputMode="decimal"
          required
          className={`w-24 ${inputClassName}`}
        />
      </Field>
      <Field label="Date received" error={state.fieldErrors?.paidOn}>
        <input
          name="paidOn"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          required
          className={inputClassName}
        />
      </Field>
      <Field label="Method" error={state.fieldErrors?.method}>
        <select name="method" defaultValue="upi" className={inputClassName}>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank transfer</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input type="radio" name="closeRequest" value="on" defaultChecked />
        Close request
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input type="radio" name="closeRequest" value="off" />
        Keep open
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input type="checkbox" name="checkedBank" />
        I have checked this in the bank account.
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClassName} h-8 px-3 text-xs`}
      >
        {pending ? "Recording…" : "Record and confirm"}
      </button>
      <FormError error={state.error} className="w-full" />
      <FormError error={state.fieldErrors?.checkedBank} className="w-full" />
    </form>
  );
}

export function RequestTimeline({
  requests,
  role,
}: {
  requests: RequestTimelineEntry[];
  role: Role;
}) {
  if (requests.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
        Payment requests
      </h4>
      <div className="flex flex-col gap-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="rounded-md border border-hairline bg-canvas p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-ink">
                {request.referenceCode} — {formatPaise(request.amountPaise)}
              </span>
              <span className="text-2xs uppercase tracking-wide text-ink-muted">
                {request.status}
                {request.closedReason
                  ? ` (${CLOSED_REASON_LABEL[request.closedReason] ?? request.closedReason})`
                  : ""}
              </span>
            </div>
            <p className="mt-1 text-2xs text-ink-muted">
              Created {formatLogDate(request.createdAt)}
              {request.sharedAt
                ? ` · Shared via ${request.sharedVia ?? "unknown"}${
                    request.sharedToLast4 ? ` (ending ${request.sharedToLast4})` : ""
                  } on ${formatLogDate(request.sharedAt)}`
                : ""}
            </p>

            {request.claims.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-2xs text-ink-secondary">
                {request.claims.map((claim) => (
                  <li key={claim.id}>
                    {claim.status} — {formatPaise(claim.claimedAmountPaise)}, UTR{" "}
                    {claim.utr} ({claim.claimedPaidOn}
                    {claim.source === "admin_entered" ? ", entered by admin" : ""})
                  </li>
                ))}
              </ul>
            ) : null}

            {role === "admin" && request.status === "open" ? (
              <EnterClaimForm paymentRequestId={request.id} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
