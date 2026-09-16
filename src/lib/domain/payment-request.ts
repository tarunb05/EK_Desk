// Everything a payment-link create/cancel action (Phase 15.2) and the
// webhook (15.3) both need that's pure enough to unit-test without a
// database or a Razorpay call: the link's own state machine, whether an
// amount is allowed against a fee account's pending balance, and mapping
// an admin's expiry choice to a Razorpay `expire_by` timestamp.

export type PaymentRequestStatus = "open" | "paid" | "cancelled" | "expired";
export type PaymentRequestEvent = "paid" | "cancelled" | "expired";

export interface PaymentRequestTransition {
  nextStatus: PaymentRequestStatus;
  // True only when a `paid` event arrives after the request had already
  // moved to cancelled/expired -- the parent's money still moved, so the
  // payment still gets recorded (never dropped), but this needs a human's
  // attention: something raced (an admin cancelled the same moment the
  // parent paid, or Razorpay's own expiry fired before its "paid" webhook
  // arrived).
  flagged: boolean;
}

// paid always wins and is never reverted -- a recorded payment is never
// un-recorded. cancelled/expired never move a request that's already paid,
// and never reopen one that's already cancelled/expired (both terminal).
export function nextPaymentRequestStatus(
  current: PaymentRequestStatus,
  event: PaymentRequestEvent,
): PaymentRequestTransition {
  if (event === "paid") {
    // Only flag a paid event that arrives after the request had already
    // moved to a DIFFERENT terminal state -- that's the real anomaly (a
    // race between an admin's cancel and the parent's payment, or
    // Razorpay's expiry firing before its own "paid" webhook). A duplicate
    // paid-on-paid is just Razorpay's at-least-once delivery retrying the
    // same event, which webhook_event's dedup (15.3) already expects and
    // handles routinely -- not something to raise a flag over.
    return {
      nextStatus: "paid",
      flagged: current === "cancelled" || current === "expired",
    };
  }
  if (current !== "open") {
    return { nextStatus: current, flagged: false };
  }
  return { nextStatus: event, flagged: false };
}

export interface PaymentLinkAmountCheck {
  ok: boolean;
  message?: string;
}

// Bounds only -- parsing a typed rupee string into paise is
// parseRupeesToPaise's job (money.ts), and reading the account's actual
// pending_paise is the caller's job (fee_account_balance, read fresh on
// the server, never trusted from the client). This just answers "is this
// amount allowed", so it's testable with plain bigints.
export function validatePaymentLinkAmount(
  amountPaise: bigint,
  pendingPaise: bigint,
): PaymentLinkAmountCheck {
  if (amountPaise <= 0n) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }
  if (amountPaise > pendingPaise) {
    return { ok: false, message: "Amount can't be more than the pending balance." };
  }
  return { ok: true };
}

export const PAYMENT_LINK_EXPIRY_DAYS = [1, 3, 7, 14, 30] as const;
export type PaymentLinkExpiryDays = (typeof PAYMENT_LINK_EXPIRY_DAYS)[number];

const MIN_EXPIRY_MINUTES = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

// Razorpay's expire_by is a Unix timestamp in seconds. `now` is a parameter
// rather than read internally (Date.now()) so this stays pure -- the
// caller (the create action, in 15.2) passes the real clock.
export function expiryDaysToExpireBy(
  days: PaymentLinkExpiryDays,
  now: Date,
): number {
  const candidateMs = now.getTime() + days * MS_PER_DAY;
  const minimumMs = now.getTime() + MIN_EXPIRY_MINUTES * MS_PER_MINUTE;
  return Math.floor(Math.max(candidateMs, minimumMs) / 1000);
}

// NPCI raised the UPI per-transaction cap for select merchant categories
// (education among them) from ₹1,00,000 to ₹5,00,000, effective
// 2026-09-15 -- confirmed against Razorpay's own transaction-limits docs
// on 2026-09-16 (https://razorpay.com/docs/payment-gateway/transaction-limits/upi/).
// This only actually applies if the Razorpay account is registered under
// an education MCC -- worth confirming on the live dashboard before 15.2
// wires this into the create-link action, not assumed from this constant
// alone.
export const UPI_PER_TRANSACTION_LIMIT_PAISE = 500_000_00n; // ₹5,00,000
