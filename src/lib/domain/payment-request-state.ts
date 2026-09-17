export type PaymentRequestStatus = "open" | "closed" | "cancelled";

// Every way an open request stops being open (brief section 6 + section 2's
// "changing an account cancels its open requests"). closed_reason is set
// whenever status leaves 'open', regardless of which of the two terminal
// statuses it lands in -- one column answers "why", the status column
// answers "how the UI should read it" (closed = ended on its own terms,
// cancelled = an admin or an account change ended it).
export type PaymentRequestCloseReason =
  | "paid"
  | "pending_cleared"
  | "expired"
  | "cancelled"
  | "account_changed"
  // The fee account itself changed under the request (discontinued, or its
  // receivable lowered below the request's own amount) -- distinct from
  // account_changed, which is specifically about the *collection* account's
  // UPI/bank details (Phase 15.2). Added in 15.3; not in the brief's own
  // suggested list, which has no value for this case (pending_cleared
  // implies the debt was paid off, which isn't true here).
  | "fee_account_changed";

export interface PaymentRequestTransition {
  nextStatus: PaymentRequestStatus;
  closedReason: PaymentRequestCloseReason | null;
  // false when the request was already terminal -- a no-op, not an error.
  // The brief is explicit that confirming a claim on an already-closed or
  // expired request is allowed (the money arrived); this is what lets that
  // caller skip re-closing a request that's already closed.
  changed: boolean;
}

const REASON_TO_STATUS: Record<PaymentRequestCloseReason, PaymentRequestStatus> =
  {
    paid: "closed",
    pending_cleared: "closed",
    expired: "closed",
    cancelled: "cancelled",
    account_changed: "cancelled",
    fee_account_changed: "cancelled",
  };

export function closePaymentRequest(
  current: PaymentRequestStatus,
  reason: PaymentRequestCloseReason,
): PaymentRequestTransition {
  if (current !== "open") {
    return { nextStatus: current, closedReason: null, changed: false };
  }
  return {
    nextStatus: REASON_TO_STATUS[reason],
    closedReason: reason,
    changed: true,
  };
}

export type PaymentClaimStatus = "pending" | "confirmed" | "rejected";

export interface PaymentClaimTransition {
  nextStatus: PaymentClaimStatus;
  changed: boolean;
}

// A claim only ever moves once, out of 'pending' -- reviewing an
// already-reviewed claim again (a double-submit of the confirm/reject form,
// a second admin racing the first) is a no-op, not a second write.
export function reviewPaymentClaim(
  current: PaymentClaimStatus,
  outcome: "confirmed" | "rejected",
): PaymentClaimTransition {
  if (current !== "pending") {
    return { nextStatus: current, changed: false };
  }
  return { nextStatus: outcome, changed: true };
}

// Read-time expiry, same rule as overdue (CLAUDE.md rule 4): an 'open'
// request whose expires_at has passed reads as expired without a row ever
// being written to say so, until something (a claim confirm, a new request,
// a cron-less lazy check) actually closes it.
export function isPaymentRequestExpired(
  status: PaymentRequestStatus,
  expiresAt: Date,
  now: Date,
): boolean {
  return status === "open" && expiresAt.getTime() < now.getTime();
}
