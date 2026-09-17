import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeRunningBalances } from "@/lib/domain/running-balance";
import type { Payment } from "@/lib/domain/types";
import type { ServiceType } from "@/lib/records/types";

export interface StudentInfo {
  id: string;
  fullName: string;
  guardianName: string;
  phone: string;
  classSection: string;
  admissionNo: string;
  branchName: string;
  status: string;
  notes: string | null;
}

interface PaymentWithMeta extends Payment {
  id: string;
  method: string;
  reference: string | null;
  note: string | null;
  recordedBy: string;
  voidReason: string | null;
}

export interface PaymentHistoryEntry {
  id: string;
  amountPaise: bigint;
  paidOn: string;
  method: string;
  reference: string | null;
  note: string | null;
  recordedBy: string;
  voidedAt: string | null;
  voidReason: string | null;
  runningPendingPaise: bigint | null;
  // Set when this payment came from a confirmed claim (Phase 15.5) --
  // "UPI, ref ending 4821, confirmed by <admin>" instead of the plain
  // method label, per the brief.
  confirmedByLabel: string | null;
}

export interface RequestClaim {
  id: string;
  utr: string;
  claimedAmountPaise: bigint;
  claimedPaidOn: string;
  status: string;
  source: string;
}

export interface RequestTimelineEntry {
  id: string;
  referenceCode: string;
  amountPaise: bigint;
  status: string;
  closedReason: string | null;
  createdAt: string;
  sharedAt: string | null;
  sharedVia: string | null;
  sharedToLast4: string | null;
  claims: RequestClaim[];
}

export interface StudentFeeAccountDetail {
  feeAccountId: string;
  serviceType: ServiceType;
  totalReceivablePaise: bigint;
  collectedPaise: bigint;
  pendingPaise: bigint;
  dueDate: string;
  status: string;
  payments: PaymentHistoryEntry[];
  // Every payment_request ever created against this account, newest
  // first -- decision 6 (Phase 15.5 plan): shows what the schema actually
  // recorded (created, latest share, every claim, terminal reason), not a
  // per-reminder history that was never stored.
  paymentRequests: RequestTimelineEntry[];
}

export interface StudentDetail {
  student: StudentInfo;
  feeAccounts: StudentFeeAccountDetail[];
}

export async function getStudentDetail(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<StudentDetail | null> {
  const { data: student, error: studentError } = await supabase
    .from("student")
    .select(
      "id, full_name, guardian_name, phone, class_section, admission_no, status, notes, branch:branch_id(name)",
    )
    .eq("id", studentId)
    .single();

  if (studentError || !student) {
    return null;
  }

  const { data: feeAccounts, error: feeAccountsError } = await supabase
    .from("fee_account_balance")
    .select("*")
    .eq("student_id", studentId);

  if (feeAccountsError || !feeAccounts) {
    return null;
  }

  const feeAccountIds = feeAccounts
    .map((row) => row.fee_account_id)
    .filter((id): id is string => !!id);

  const { data: payments, error: paymentsError } =
    feeAccountIds.length > 0
      ? await supabase
          .from("payment")
          .select("*")
          .in("fee_account_id", feeAccountIds)
      : { data: [], error: null };

  if (paymentsError) {
    return null;
  }

  const paymentsByAccount = new Map<string, PaymentWithMeta[]>();
  for (const payment of payments ?? []) {
    const list = paymentsByAccount.get(payment.fee_account_id) ?? [];
    list.push({
      id: payment.id,
      amountPaise: BigInt(payment.amount_paise),
      paidOn: new Date(payment.paid_on),
      voidedAt: payment.voided_at ? new Date(payment.voided_at) : null,
      method: payment.method,
      reference: payment.reference,
      note: payment.note,
      recordedBy: payment.recorded_by,
      voidReason: payment.void_reason,
    });
    paymentsByAccount.set(payment.fee_account_id, list);
  }

  // Every payment_request against these accounts, with its own claims
  // nested -- the request timeline (Phase 15.5) and the "confirmed by"
  // label on the payment history table both come from this one query.
  const { data: requests } =
    feeAccountIds.length > 0
      ? await supabase
          .from("payment_request")
          .select(
            `id, fee_account_id, reference_code, amount_paise, status, closed_reason,
             created_at, shared_at, shared_via, shared_to_last4,
             payment_claim ( id, utr, claimed_amount_paise, claimed_paid_on, status, source, payment_id, reviewed_by )`,
          )
          .in("fee_account_id", feeAccountIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const reviewedByIds = Array.from(
    new Set(
      (requests ?? []).flatMap((r) =>
        r.payment_claim
          .filter((c) => c.status === "confirmed" && c.payment_id && c.reviewed_by)
          .map((c) => c.reviewed_by as string),
      ),
    ),
  );
  const { data: reviewers } =
    reviewedByIds.length > 0
      ? await supabase.from("profile").select("id, full_name").in("id", reviewedByIds)
      : { data: [] };
  const reviewerName = new Map((reviewers ?? []).map((p) => [p.id, p.full_name]));

  const confirmedByLabelByPaymentId = new Map<string, string>();
  for (const request of requests ?? []) {
    for (const claim of request.payment_claim) {
      if (claim.status === "confirmed" && claim.payment_id && claim.reviewed_by) {
        confirmedByLabelByPaymentId.set(
          claim.payment_id,
          reviewerName.get(claim.reviewed_by) ?? "Admin",
        );
      }
    }
  }

  const requestsByAccount = new Map<string, RequestTimelineEntry[]>();
  for (const request of requests ?? []) {
    const list = requestsByAccount.get(request.fee_account_id) ?? [];
    list.push({
      id: request.id,
      referenceCode: request.reference_code,
      amountPaise: BigInt(request.amount_paise),
      status: request.status,
      closedReason: request.closed_reason,
      createdAt: request.created_at,
      sharedAt: request.shared_at,
      sharedVia: request.shared_via,
      sharedToLast4: request.shared_to_last4,
      claims: request.payment_claim.map((c) => ({
        id: c.id,
        utr: c.utr,
        claimedAmountPaise: BigInt(c.claimed_amount_paise),
        claimedPaidOn: c.claimed_paid_on,
        status: c.status,
        source: c.source,
      })),
    });
    requestsByAccount.set(request.fee_account_id, list);
  }

  const feeAccountDetails: StudentFeeAccountDetail[] = feeAccounts.map((fa) => {
    const accountPayments =
      paymentsByAccount.get(fa.fee_account_id ?? "") ?? [];
    const runningBalances = computeRunningBalances(
      BigInt(fa.total_receivable_paise ?? 0),
      accountPayments,
    );

    const history: PaymentHistoryEntry[] = runningBalances
      .map((entry) => ({
        id: entry.payment.id,
        amountPaise: entry.payment.amountPaise,
        paidOn: entry.payment.paidOn.toISOString().slice(0, 10),
        method: entry.payment.method,
        reference: entry.payment.reference,
        note: entry.payment.note,
        recordedBy: entry.payment.recordedBy,
        voidedAt: entry.payment.voidedAt
          ? entry.payment.voidedAt.toISOString()
          : null,
        voidReason: entry.payment.voidReason,
        runningPendingPaise: entry.runningPendingPaise,
        confirmedByLabel: confirmedByLabelByPaymentId.get(entry.payment.id) ?? null,
      }))
      .reverse();

    return {
      feeAccountId: fa.fee_account_id ?? "",
      serviceType: (fa.service_type ?? "transport") as ServiceType,
      totalReceivablePaise: BigInt(fa.total_receivable_paise ?? 0),
      collectedPaise: BigInt(fa.collected_paise ?? 0),
      pendingPaise: BigInt(fa.pending_paise ?? 0),
      dueDate: fa.due_date ?? "",
      status: fa.status ?? "active",
      payments: history,
      paymentRequests: requestsByAccount.get(fa.fee_account_id ?? "") ?? [],
    };
  });

  const branch = student.branch as { name: string } | null;

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      guardianName: student.guardian_name,
      phone: student.phone,
      classSection: student.class_section,
      admissionNo: student.admission_no,
      branchName: branch?.name ?? "",
      status: student.status,
      notes: student.notes,
    },
    feeAccounts: feeAccountDetails,
  };
}
