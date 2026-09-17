"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import {
  confirmClaimSchema,
  enterAndConfirmClaimSchema,
  rejectClaimSchema,
} from "@/lib/claims/schemas";

export interface ClaimActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

function revalidateAfterConfirm() {
  revalidatePath("/verify");
  revalidatePath("/students", "page");
  revalidatePath("/transport", "page");
  revalidatePath("/daycare", "page");
}

export async function confirmClaim(
  _prevState: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const parsed = confirmClaimSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const authed = await requireRole("admin");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("confirm_payment_claim", {
    p_claim_id: parsed.data.claimId,
    p_received_amount_paise: Number(parsed.data.amount),
    p_received_paid_on: parsed.data.paidOn,
    p_method: parsed.data.method,
    p_close_request: parsed.data.closeRequest,
  });

  if (error) {
    return { error: "Could not confirm this claim — it may already be reviewed." };
  }

  // Ids and amounts only -- no UTR, no student/guardian name, no phone.
  console.log(
    `[claim] confirmed by=${authed.userId} claim=${parsed.data.claimId} amountPaise=${parsed.data.amount} payment=${(data as { paymentId: string } | null)?.paymentId ?? ""}`,
  );

  revalidateAfterConfirm();
  return { error: null };
}

export async function rejectClaim(
  _prevState: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const parsed = rejectClaimSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const authed = await requireRole("admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("payment_claim")
    .update({
      status: "rejected",
      reject_reason: parsed.data.reason,
      reviewed_by: authed.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.claimId)
    .eq("status", "pending");

  if (error) {
    return { error: "Could not reject this claim." };
  }

  console.log(`[claim] rejected by=${authed.userId} claim=${parsed.data.claimId}`);

  revalidatePath("/verify");
  return { error: null };
}

export async function enterAndConfirmClaim(
  _prevState: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const parsed = enterAndConfirmClaimSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const authed = await requireRole("admin");
  const supabase = await createClient();

  const { error } = await supabase.rpc("enter_and_confirm_claim", {
    p_payment_request_id: parsed.data.paymentRequestId,
    p_utr: parsed.data.utr,
    p_claimed_amount_paise: Number(parsed.data.claimedAmount),
    p_claimed_paid_on: parsed.data.claimedPaidOn,
    p_received_amount_paise: Number(parsed.data.amount),
    p_received_paid_on: parsed.data.paidOn,
    p_method: parsed.data.method,
    p_close_request: parsed.data.closeRequest,
  });

  if (error) {
    return { error: "Could not record and confirm this claim." };
  }

  console.log(
    `[claim] entered and confirmed by=${authed.userId} paymentRequest=${parsed.data.paymentRequestId} amountPaise=${parsed.data.amount}`,
  );

  revalidateAfterConfirm();
  return { error: null };
}
