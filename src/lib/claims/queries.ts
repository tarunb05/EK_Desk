import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { formatPaise } from "@/lib/domain/money";
import { isPaymentRequestExpired } from "@/lib/domain/payment-request-state";

const SERVICE_LABEL: Record<string, string> = {
  transport: "Transport",
  daycare: "Daycare",
};

export interface PendingClaim {
  id: string;
  paymentRequestId: string;
  feeAccountId: string;
  studentName: string;
  branchName: string;
  serviceLabel: string;
  requestedAmountPaise: bigint;
  claimedAmountPaise: bigint;
  utr: string;
  claimedPaidOn: string;
  source: "parent_page" | "admin_entered";
  createdAt: string;
  duplicateUtr: boolean;
  amountDiffers: boolean;
  requestExpiredOrClosed: boolean;
  requestedAmountDisplay: string;
  claimedAmountDisplay: string;
}

export async function getPendingClaimsCount(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { count } = await supabase
    .from("payment_claim")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

export interface OpenRequest {
  id: string;
  feeAccountId: string;
  studentName: string;
  branchName: string;
  serviceLabel: string;
  amountPaise: bigint;
  amountDisplay: string;
  referenceCode: string;
  createdAt: string;
  expiresAt: string;
}

// Every open request nobody has paid (or claimed) yet -- a claim already
// pending review for a request is shown there instead (see
// getPendingClaims), not duplicated here, so an admin only ever sees one
// row, with one clear next action, per request.
export async function getOpenRequests(
  supabase: SupabaseClient<Database>,
): Promise<OpenRequest[]> {
  const [{ data: requests }, { data: pendingClaims }] = await Promise.all([
    supabase
      .from("payment_request")
      .select(
        `id, fee_account_id, amount_paise, reference_code, created_at, expires_at,
         fee_account:fee_account_id (
           service_type,
           student:student_id ( full_name, branch:branch_id ( name ) )
         )`,
      )
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    supabase.from("payment_claim").select("payment_request_id").eq("status", "pending"),
  ]);

  const alreadyClaimed = new Set(
    (pendingClaims ?? []).map((c) => c.payment_request_id),
  );

  return (requests ?? [])
    .filter((request) => request.fee_account && !alreadyClaimed.has(request.id))
    .map((request) => {
      const feeAccount = request.fee_account!;
      const student = feeAccount.student!;
      const amountPaise = BigInt(request.amount_paise);
      return {
        id: request.id,
        feeAccountId: request.fee_account_id,
        studentName: student.full_name,
        branchName: student.branch.name,
        serviceLabel: SERVICE_LABEL[feeAccount.service_type] ?? feeAccount.service_type,
        amountPaise,
        amountDisplay: formatPaise(amountPaise),
        referenceCode: request.reference_code,
        createdAt: request.created_at,
        expiresAt: request.expires_at,
      };
    });
}

export async function getPendingClaims(
  supabase: SupabaseClient<Database>,
): Promise<PendingClaim[]> {
  const { data: claims } = await supabase
    .from("payment_claim")
    .select(
      `id, payment_request_id, source, utr, claimed_amount_paise, claimed_paid_on, created_at,
       payment_request:payment_request_id (
         id, fee_account_id, amount_paise, status, expires_at,
         fee_account:fee_account_id (
           service_type,
           student:student_id ( full_name, branch:branch_id ( name ) )
         )
       )`,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (!claims || claims.length === 0) return [];

  const utrs = Array.from(new Set(claims.map((claim) => claim.utr)));
  const { data: confirmed } = await supabase
    .from("payment_claim")
    .select("utr")
    .eq("status", "confirmed")
    .in("utr", utrs);
  const confirmedUtrs = new Set((confirmed ?? []).map((row) => row.utr));

  const now = new Date();

  return claims
    .filter((claim) => claim.payment_request && claim.payment_request.fee_account)
    .map((claim) => {
      const request = claim.payment_request!;
      const feeAccount = request.fee_account!;
      const student = feeAccount.student!;
      const requestedAmountPaise = BigInt(request.amount_paise);
      const claimedAmountPaise = BigInt(claim.claimed_amount_paise);

      return {
        id: claim.id,
        paymentRequestId: request.id,
        feeAccountId: request.fee_account_id,
        studentName: student.full_name,
        branchName: student.branch.name,
        serviceLabel: SERVICE_LABEL[feeAccount.service_type] ?? feeAccount.service_type,
        requestedAmountPaise,
        claimedAmountPaise,
        utr: claim.utr,
        claimedPaidOn: claim.claimed_paid_on,
        source: claim.source as "parent_page" | "admin_entered",
        createdAt: claim.created_at,
        duplicateUtr: confirmedUtrs.has(claim.utr),
        amountDiffers: requestedAmountPaise !== claimedAmountPaise,
        requestExpiredOrClosed: isPaymentRequestExpired(
          request.status as "open" | "closed" | "cancelled",
          new Date(request.expires_at),
          now,
        )
          ? true
          : request.status !== "open",
        requestedAmountDisplay: formatPaise(requestedAmountPaise),
        claimedAmountDisplay: formatPaise(claimedAmountPaise),
      };
    });
}
