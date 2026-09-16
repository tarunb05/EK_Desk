import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { cancelLink } from "./razorpay";

export interface CancelOpenLinkResult {
  error: string | null;
  // True when Razorpay reports the link as already paid -- the caller
  // decides what that means for it (createPaymentLink aborts and tells the
  // admin to refresh; every other caller just treats it as nothing left to
  // cancel, since the webhook owns recording that payment).
  alreadyPaid: boolean;
}

// Shared by createPaymentLink/cancelPaymentLink (lib/payments/actions.ts)
// and the link-killing hooks in lib/records/actions.ts (recordPayment,
// updateFeeAccount, permanentlyDeleteStudent) -- not a Server Action
// itself (no "use server" here), since a "use server" file's exports must
// all be Server Actions themselves, and this needs to be callable from
// several different ones.
//
// A plain, unexported helper duplicated into each action file was the
// alternative; this is the one place "cancel whatever's open for this fee
// account" is decided, so a change to that decision (say, a different
// cancelled_reason convention) only has one place to change.
export async function cancelOpenPaymentLink(
  supabase: SupabaseClient<Database>,
  feeAccountId: string,
  reason: string,
): Promise<CancelOpenLinkResult> {
  const { data: existing } = await supabase
    .from("payment_request")
    .select("id, gateway_link_id")
    .eq("fee_account_id", feeAccountId)
    .eq("status", "open")
    .maybeSingle();

  if (!existing) {
    return { error: null, alreadyPaid: false };
  }

  if (existing.gateway_link_id) {
    const result = await cancelLink(existing.gateway_link_id);
    if (!result.ok) {
      if (result.reason === "already_paid") {
        // Don't touch the row -- the webhook (15.3) owns marking this paid
        // and recording the payment; this call didn't create that race,
        // it just discovered it.
        return { error: null, alreadyPaid: true };
      }
      // A generic Razorpay-side failure (network hiccup, etc.) still lets
      // this proceed to mark the row cancelled here: the caller's own
      // state change (a payment clearing pending, a discontinue, a lowered
      // receivable) is the real event being recorded, and a stray
      // still-technically-open Razorpay link with no database row backing
      // it is harmless -- nothing in this app treats it as payable without
      // the row.
    }
  }

  const { error } = await supabase
    .from("payment_request")
    .update({ status: "cancelled", cancelled_reason: reason })
    .eq("id", existing.id);

  return {
    error: error ? "Could not cancel the existing payment link." : null,
    alreadyPaid: false,
  };
}
