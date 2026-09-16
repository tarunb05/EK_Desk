import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface OpenPaymentRequestInfo {
  id: string;
  shortUrl: string;
  expiresAt: string;
  amountPaise: bigint;
}

export interface PaymentLinkButtonInfo {
  pendingPaise: bigint;
  openLink: OpenPaymentRequestInfo | null;
}

// Everything the Students list's PaymentLinkButton needs per fee account,
// in two batched queries rather than one per row (the same N+1 shape this
// codebase avoids everywhere else -- approvals.ts, support/queries.ts).
// student_directory (what the Students list itself already queries) has
// no per-account pending_paise, only a row-level total across every
// account a student has -- reusing fee_account_record (already proven,
// already has pending_paise) here avoids touching that view at all.
//
// Admin-only in practice: payment_request's RLS ("admin full access", no
// teacher policy) returns nothing for anyone else. Callers should still
// skip calling this for a teacher, matching the "don't even ask" pattern
// used everywhere else money is admin-scoped in this app.
export async function getPaymentLinkButtonInfo(
  supabase: SupabaseClient<Database>,
  feeAccountIds: string[],
): Promise<Map<string, PaymentLinkButtonInfo>> {
  if (feeAccountIds.length === 0) {
    return new Map();
  }

  const [{ data: records }, { data: openRequests }] = await Promise.all([
    supabase
      .from("fee_account_record")
      .select("fee_account_id, pending_paise")
      .in("fee_account_id", feeAccountIds),
    supabase
      .from("payment_request")
      .select("id, fee_account_id, short_url, expires_at, amount_paise")
      .eq("status", "open")
      .in("fee_account_id", feeAccountIds),
  ]);

  const openLinkByFeeAccount = new Map(
    (openRequests ?? []).map((row) => [
      row.fee_account_id,
      {
        id: row.id,
        shortUrl: row.short_url ?? "",
        expiresAt: row.expires_at,
        amountPaise: BigInt(row.amount_paise),
      },
    ]),
  );

  return new Map(
    (records ?? [])
      .filter((r): r is typeof r & { fee_account_id: string } => !!r.fee_account_id)
      .map((r) => [
        r.fee_account_id,
        {
          pendingPaise: BigInt(r.pending_paise ?? 0),
          openLink: openLinkByFeeAccount.get(r.fee_account_id) ?? null,
        },
      ]),
  );
}
