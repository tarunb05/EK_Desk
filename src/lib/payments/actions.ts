"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import {
  UPI_PER_TRANSACTION_LIMIT_PAISE,
  expiryDaysToExpireBy,
  validatePaymentLinkAmount,
} from "@/lib/domain/payment-request";
import { cancelLink, createLink } from "@/lib/payments/razorpay";
import { cancelOpenPaymentLink } from "@/lib/payments/link-lifecycle";
import {
  cancelPaymentLinkSchema,
  createPaymentLinkSchema,
} from "@/lib/payments/schemas";

export interface PaymentLinkActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Non-blocking: shown alongside a successful link (amount is above the
  // UPI per-transaction limit, so UPI won't be offered on it, but
  // netbanking/card still work -- see the Phase 15 plan's answer on this).
  warning?: string;
  link?: { id: string; shortUrl: string; expiresAt: string };
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

// "A few links per minute is plenty" (Phase 15 brief) -- backed by a
// query against payment_request itself rather than an in-memory counter:
// an in-memory Map would reset on every cold start and wouldn't be shared
// across serverless instances, silently doing nothing under real
// production traffic. This needs no new dependency and no new
// infrastructure, just one extra count() already against a table this
// action already touches.
const RATE_LIMIT_MAX_PER_MINUTE = 5;

export async function createPaymentLink(
  _prevState: PaymentLinkActionState,
  formData: FormData,
): Promise<PaymentLinkActionState> {
  const parsed = createPaymentLinkSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;

  // Re-derives the actor from the session -- Server Actions are public
  // endpoints (Phase 15 brief), never trust a client-supplied admin id.
  const authed = await requireRole("admin");
  const supabase = await createClient();

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabase
    .from("payment_request")
    .select("id", { count: "exact", head: true })
    .eq("created_by", authed.userId)
    .gte("created_at", oneMinuteAgo);

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_PER_MINUTE) {
    return {
      error: "Too many links created in the last minute — wait a moment and try again.",
    };
  }

  const { data: record, error: recordError } = await supabase
    .from("fee_account_record")
    .select("pending_paise, status, branch_name, service_type, student_admission_no")
    .eq("fee_account_id", value.feeAccountId)
    .maybeSingle();

  if (recordError || !record) {
    return { error: "Could not find that fee account." };
  }
  if (record.status === "discontinued") {
    return {
      error: "This fee account is discontinued — a payment link can't be created for it.",
    };
  }

  const pendingPaise = BigInt(record.pending_paise ?? 0);
  const amountCheck = validatePaymentLinkAmount(value.amount, pendingPaise);
  if (!amountCheck.ok) {
    return { error: amountCheck.message ?? "Invalid amount." };
  }

  const cancelResult = await cancelOpenPaymentLink(
    supabase,
    value.feeAccountId,
    "Superseded by a new link",
  );
  if (cancelResult.alreadyPaid) {
    return {
      error: "This account was just paid through the existing link — refresh to see the update.",
    };
  }
  if (cancelResult.error) {
    return { error: cancelResult.error };
  }

  // Generated up front rather than left to the table's own default, so it
  // can be Razorpay's reference_id at creation time -- the row referencing
  // Razorpay's own id (gateway_link_id) doesn't exist yet at that point,
  // this is the only order that works without a second round trip.
  const paymentRequestId = crypto.randomUUID();
  const expireBy = expiryDaysToExpireBy(value.expiryDays, new Date());

  const created = await createLink({
    amountPaise: value.amount,
    referenceId: paymentRequestId,
    description: `${record.branch_name} — ${record.service_type} — ${record.student_admission_no}`,
    expireBy,
    // callbackUrl omitted -- see its own comment in razorpay.ts.
  });

  if (!created.ok) {
    return { error: created.error };
  }

  const { error: insertError } = await supabase.from("payment_request").insert({
    id: paymentRequestId,
    fee_account_id: value.feeAccountId,
    amount_paise: Number(value.amount),
    gateway_link_id: created.link.id,
    short_url: created.link.shortUrl,
    expires_at: new Date(expireBy * 1000).toISOString(),
    created_by: authed.userId,
  });

  if (insertError) {
    // Razorpay succeeded but our own insert didn't -- cancel the orphaned
    // link rather than leave a link that can take real money with no
    // database row tracking it.
    await cancelLink(created.link.id);
    return { error: "Could not save this payment link — try again." };
  }

  // Actor id, fee account id, payment request id, amount -- no name, no
  // phone, no URL (Phase 15 brief section 2.9).
  console.log(
    `[payment-link] created by=${authed.userId} feeAccount=${value.feeAccountId} paymentRequest=${paymentRequestId} amountPaise=${value.amount}`,
  );

  revalidatePath("/students", "page");

  const warning =
    value.amount > UPI_PER_TRANSACTION_LIMIT_PAISE
      ? "This amount is above the UPI limit — UPI won't be offered, but the parent can still pay by card or netbanking."
      : undefined;

  return {
    error: null,
    warning,
    link: {
      id: paymentRequestId,
      shortUrl: created.link.shortUrl,
      expiresAt: new Date(expireBy * 1000).toISOString(),
    },
  };
}

export async function cancelPaymentLink(
  _prevState: PaymentLinkActionState,
  formData: FormData,
): Promise<PaymentLinkActionState> {
  const parsed = cancelPaymentLinkSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  await requireRole("admin");
  const supabase = await createClient();

  const { data: request, error: readError } = await supabase
    .from("payment_request")
    .select("id, status, fee_account_id")
    .eq("id", parsed.data.paymentRequestId)
    .maybeSingle();

  if (readError || !request) {
    return { error: "Could not find this payment link." };
  }
  if (request.status !== "open") {
    return { error: "This link is no longer open." };
  }

  const result = await cancelOpenPaymentLink(
    supabase,
    request.fee_account_id,
    "Cancelled by admin",
  );

  if (result.alreadyPaid) {
    return {
      error: "This link was just paid — refresh to see the update.",
    };
  }
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/students", "page");
  return { error: null };
}
