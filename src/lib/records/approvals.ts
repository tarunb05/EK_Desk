import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { formatPaise } from "@/lib/domain/money";

export interface PendingStudentSubmission {
  table: "student_submission";
  id: string;
  submittedAt: string;
  branchId: string;
  summary: string;
  detail: { label: string; value: string }[];
}

export interface PendingStudentEditSubmission {
  table: "student_edit_submission";
  id: string;
  submittedAt: string;
  branchId: string;
  summary: string;
  detail: { label: string; value: string }[];
}

export interface PendingPaymentSubmission {
  table: "payment_submission";
  id: string;
  submittedAt: string;
  branchId: string;
  summary: string;
  detail: { label: string; value: string }[];
}

export type PendingSubmission =
  | PendingStudentSubmission
  | PendingStudentEditSubmission
  | PendingPaymentSubmission;

export async function getPendingSubmissionCount(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const [students, edits, payments] = await Promise.all([
    supabase
      .from("student_submission")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("student_edit_submission")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("payment_submission")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    (students.count ?? 0) + (edits.count ?? 0) + (payments.count ?? 0)
  );
}

export async function getPendingSubmissions(
  supabase: SupabaseClient<Database>,
): Promise<PendingSubmission[]> {
  const [students, edits, payments] = await Promise.all([
    supabase
      .from("student_submission")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("student_edit_submission")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("payment_submission")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
  ]);

  const submittedByIds = new Set<string>();
  for (const row of students.data ?? []) submittedByIds.add(row.submitted_by);
  for (const row of edits.data ?? []) submittedByIds.add(row.submitted_by);
  for (const row of payments.data ?? []) submittedByIds.add(row.submitted_by);

  const { data: profiles } = await supabase
    .from("profile")
    .select("id, full_name")
    .in("id", Array.from(submittedByIds));
  const submittedByName = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name]),
  );

  // A payment submission only stores fee_account_id -- fee_account_record
  // already carries every student/guardian/branch field in one place, so
  // reuse it rather than re-deriving the same join by hand.
  const feeAccountIds = Array.from(
    new Set((payments.data ?? []).map((row) => row.fee_account_id)),
  );
  const { data: feeAccountRecords } =
    feeAccountIds.length > 0
      ? await supabase
          .from("fee_account_record")
          .select("*")
          .in("fee_account_id", feeAccountIds)
      : { data: [] };
  const feeAccountById = new Map(
    (feeAccountRecords ?? []).map((row) => [row.fee_account_id, row]),
  );

  const studentRows: PendingStudentSubmission[] = (students.data ?? []).map(
    (row) => ({
      table: "student_submission",
      id: row.id,
      submittedAt: row.submitted_at,
      branchId: row.branch_id,
      summary: `New student — ${row.full_name} (${row.service_type})`,
      detail: [
        { label: "Submitted by", value: submittedByName.get(row.submitted_by) ?? "" },
        { label: "Admission no.", value: row.admission_no },
        { label: "Full name", value: row.full_name },
        { label: "Guardian", value: row.guardian_name },
        { label: "Phone", value: row.phone },
        { label: "Grade", value: row.class_section },
        { label: "Notes", value: row.notes ?? "" },
        { label: "Service", value: row.service_type },
        {
          label: "Total receivable",
          value: formatPaise(BigInt(row.total_receivable_paise)),
        },
        { label: "Due date", value: row.due_date },
        { label: "Starts on", value: row.starts_on },
        { label: "Ends on", value: row.ends_on },
        ...(row.service_type === "transport"
          ? [
              { label: "Route name", value: row.route_name ?? "" },
              { label: "Pickup point", value: row.pickup_point ?? "" },
            ]
          : [{ label: "Slot", value: row.slot ?? "" }]),
      ],
    }),
  );

  const editRows: PendingStudentEditSubmission[] = (edits.data ?? []).map(
    (row) => ({
      table: "student_edit_submission",
      id: row.id,
      submittedAt: row.submitted_at,
      branchId: row.branch_id,
      summary: `Edit — ${row.full_name}`,
      detail: [
        { label: "Submitted by", value: submittedByName.get(row.submitted_by) ?? "" },
        { label: "Full name", value: row.full_name },
        { label: "Guardian", value: row.guardian_name },
        { label: "Phone", value: row.phone },
        { label: "Grade", value: row.class_section },
        { label: "Notes", value: row.notes ?? "" },
        {
          label: "Total receivable",
          value: formatPaise(BigInt(row.total_receivable_paise)),
        },
        { label: "Due date", value: row.due_date },
        { label: "Starts on", value: row.starts_on },
        { label: "Ends on", value: row.ends_on },
        { label: "Fee account status", value: row.fee_account_status },
        { label: "Route name", value: row.route_name ?? "" },
        { label: "Pickup point", value: row.pickup_point ?? "" },
        { label: "Slot", value: row.slot ?? "" },
      ],
    }),
  );

  const paymentRows: PendingPaymentSubmission[] = (payments.data ?? []).map(
    (row) => {
      const feeAccount = feeAccountById.get(row.fee_account_id);
      return {
        table: "payment_submission",
        id: row.id,
        submittedAt: row.submitted_at,
        branchId: row.branch_id,
        summary: feeAccount
          ? `Payment — ${feeAccount.student_full_name} — ${formatPaise(BigInt(row.amount_paise))} (${row.method})`
          : `Payment — ${formatPaise(BigInt(row.amount_paise))} (${row.method})`,
        detail: [
          {
            label: "Submitted by",
            value: submittedByName.get(row.submitted_by) ?? "",
          },
          { label: "Amount", value: formatPaise(BigInt(row.amount_paise)) },
          { label: "Paid on", value: row.paid_on },
          { label: "Method", value: row.method },
          { label: "Reference", value: row.reference ?? "" },
          { label: "Note", value: row.note ?? "" },
          {
            label: "Student",
            value: feeAccount?.student_full_name ?? "",
          },
          {
            label: "Admission no.",
            value: feeAccount?.student_admission_no ?? "",
          },
          { label: "Guardian", value: feeAccount?.student_guardian_name ?? "" },
          { label: "Phone", value: feeAccount?.student_phone ?? "" },
          { label: "Grade", value: feeAccount?.class_section ?? "" },
          { label: "Branch", value: feeAccount?.branch_name ?? "" },
          { label: "Service", value: feeAccount?.service_type ?? "" },
          {
            label: "Pending before this payment",
            value: feeAccount
              ? formatPaise(BigInt(feeAccount.pending_paise ?? 0))
              : "",
          },
        ],
      };
    },
  );

  return [...studentRows, ...editRows, ...paymentRows].sort((a, b) =>
    a.submittedAt.localeCompare(b.submittedAt),
  );
}
