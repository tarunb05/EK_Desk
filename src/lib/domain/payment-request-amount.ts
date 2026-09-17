export interface AmountCheckResult {
  ok: boolean;
  message?: string;
}

// Pure bound check against a pending figure the caller already read from
// fee_account_balance -- the read itself is a 15.3 Server Action concern.
// "never raise" (brief step 2) is enforced by the upper bound; a part
// payment is any value strictly between 0 and pending, inclusive of pending
// itself (paying off the full balance in one request is not "raising" it).
export function validateRequestAmount(
  amountPaise: bigint,
  pendingPaise: bigint,
): AmountCheckResult {
  if (amountPaise <= 0n) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }
  if (amountPaise > pendingPaise) {
    return {
      ok: false,
      message: "This is more than the pending amount.",
    };
  }
  return { ok: true };
}
