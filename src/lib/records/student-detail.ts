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
      "id, full_name, guardian_name, phone, class_section, admission_no, branch:branch_id(name)",
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
    },
    feeAccounts: feeAccountDetails,
  };
}
