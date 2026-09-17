"use client";

import { useActionState, useState } from "react";
import { confirmClaim, rejectClaim, type ClaimActionState } from "@/lib/claims/actions";
import type { PendingClaim } from "@/lib/claims/queries";
import { paiseToRupeesInputString } from "@/lib/domain/money";
import { formatLogTimestamp } from "@/lib/domain/datetime";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
  dangerButtonClassName,
} from "@/components/forms/field";

const initialState: ClaimActionState = { error: null };

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-surface-accent px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-secondary">
      {children}
    </span>
  );
}

export function ClaimRow({ claim }: { claim: PendingClaim }) {
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmClaim,
    initialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectClaim,
    initialState,
  );
  const [receivedAmount, setReceivedAmount] = useState(
    paiseToRupeesInputString(claim.claimedAmountPaise),
  );

  const receivedPaise = (() => {
    const value = Number(receivedAmount);
    return Number.isFinite(value) ? BigInt(Math.round(value * 100)) : 0n;
  })();
  const remainingPaise = claim.requestedAmountPaise - receivedPaise;
  const remainingDisplay =
    remainingPaise > 0n
      ? `₹${(Number(remainingPaise) / 100).toLocaleString("en-IN")}`
      : "₹0";

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink">
            {claim.studentName} — {claim.branchName} · {claim.serviceLabel}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Requested {claim.requestedAmountDisplay} · Claimed{" "}
            {claim.claimedAmountDisplay} on {claim.claimedPaidOn}
          </p>
          <p className="mt-1 text-2xs text-ink-muted">
            UTR {claim.utr} · {claim.source === "admin_entered" ? "Entered by admin" : "From pay page"} ·{" "}
            {formatLogTimestamp(claim.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {claim.duplicateUtr ? <Flag>Duplicate UTR</Flag> : null}
          {claim.amountDiffers ? <Flag>Amount differs</Flag> : null}
          {claim.requestExpiredOrClosed ? <Flag>Request expired or closed</Flag> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <form
            action={confirmAction}
            noValidate
            className="flex flex-wrap items-end gap-3 rounded-md border border-hairline bg-canvas p-3"
          >
            <input type="hidden" name="claimId" value={claim.id} />
            <Field label="Amount received (₹)" error={confirmState.fieldErrors?.amount}>
              <input
                name="amount"
                inputMode="decimal"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                required
                className={`w-28 ${inputClassName}`}
              />
            </Field>
            <Field label="Date received" error={confirmState.fieldErrors?.paidOn}>
              <input
                name="paidOn"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={claim.claimedPaidOn}
                required
                className={inputClassName}
              />
            </Field>
            <Field label="Method" error={confirmState.fieldErrors?.method}>
              <select name="method" defaultValue="upi" className={inputClassName}>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </Field>
            <div className="flex flex-col gap-1.5 text-sm text-ink-secondary">
              <label className="flex items-center gap-2">
                <input type="radio" name="closeRequest" value="on" defaultChecked />
                Close request
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="closeRequest" value="off" />
                Keep open for the remaining {remainingDisplay}
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input type="checkbox" name="checkedBank" />
              I have checked this in the bank account.
            </label>
            <button
              type="submit"
              disabled={confirmPending}
              className={`${primaryButtonClassName} h-8 px-3 text-xs`}
            >
              {confirmPending ? "Confirming…" : "Confirm"}
            </button>
            <FormError error={confirmState.fieldErrors?.checkedBank} className="w-full" />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${primaryButtonClassName} h-8 px-3 text-xs`}
          >
            Confirm
          </button>
        )}

        {rejecting ? (
          <form action={rejectAction} noValidate className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="claimId" value={claim.id} />
            <input
              name="reason"
              required
              placeholder="Reason for rejecting"
              className={`h-8 text-xs ${inputClassName}`}
            />
            <button
              type="submit"
              disabled={rejectPending}
              className={`${dangerButtonClassName} h-8 px-3 text-xs`}
            >
              {rejectPending ? "Rejecting…" : "Confirm reject"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Reject
          </button>
        )}
      </div>

      <FormError error={confirmState.error} className="mt-2" />
      <FormError error={rejectState.error} className="mt-2" />
    </div>
  );
}
