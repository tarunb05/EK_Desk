import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { formatPaise } from "@/lib/domain/money";

export type SubmissionActionType =
  | "Student added"
  | "Student edited"
  | "Payment recorded"
  | "Deletion requested";

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

export interface PendingStudentSubmission {
  table: "student_submission";
  actionType: "Student added";
  id: string;
  submittedAt: string;
  branchId: string;
  summary: string;
  detail: { label: string; value: string }[];
}

export interface PendingStudentEditSubmission {
  table: "student_edit_submission";
  actionType: "Student edited";
  id: string;
  submittedAt: string;
  branchId: string;
  summary: string;
  detail: { label: string; value: string }[];
  // Only the fields the teacher actually proposed changing -- an edit
  // submission always carries every field (it's a full replace), so
  // comparing against the fee account's current values is what actually
  // answers "what change was made" instead of restating the whole record.
  changes: FieldChange[];
}

export interface PendingPaymentSubmission {
  table: "payment_submission";
  actionType: "Payment recorded";
  id: string;
  submittedAt: string;
  branchId: string;
  summary: string;
  detail: { label: string; value: string }[];
}

export interface PendingStudentDeleteSubmission {
  table: "student_delete_submission";
  actionType: "Deletion requested";
  id: string;
  submittedAt: string;
  branchId: string;
  summary: string;
  detail: { label: string; value: string }[];
}

export type PendingSubmission =
  | PendingStudentSubmission
  | PendingStudentEditSubmission
  | PendingPaymentSubmission
  | PendingStudentDeleteSubmission;

// null and "" both mean "nothing there" for these fields -- treating them as
// equal avoids flagging a no-op change (e.g. notes staying unset) as if the
// teacher had actually proposed something.
function diffField(
  label: string,
  before: string | number | bigint | null | undefined,
  after: string | number | bigint | null | undefined,
): FieldChange | null {
  const beforeStr = before === null || before === undefined ? "" : String(before);
  const afterStr = after === null || after === undefined ? "" : String(after);
  if (beforeStr === afterStr) return null;
  return { label, before: beforeStr || "—", after: afterStr || "—" };
}

export async function getPendingSubmissionCount(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const [students, edits, payments, deletes] = await Promise.all([
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
    supabase
      .from("student_delete_submission")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    (students.count ?? 0) +
    (edits.count ?? 0) +
    (payments.count ?? 0) +
    (deletes.count ?? 0)
  );
}

export async function getPendingSubmissions(
  supabase: SupabaseClient<Database>,
): Promise<PendingSubmission[]> {
  const [students, edits, payments, deletes] = await Promise.all([
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
    supabase
      .from("student_delete_submission")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true }),
  ]);

  const submittedByIds = new Set<string>();
  for (const row of students.data ?? []) submittedByIds.add(row.submitted_by);
  for (const row of edits.data ?? []) submittedByIds.add(row.submitted_by);
  for (const row of payments.data ?? []) submittedByIds.add(row.submitted_by);
  for (const row of deletes.data ?? []) submittedByIds.add(row.submitted_by);

  const { data: profiles } = await supabase
    .from("profile")
    .select("id, full_name, is_active")
    .in("id", Array.from(submittedByIds));
  // A submitter deactivated since (Settings' "Delete" on a teacher archives
  // rather than removes -- see deactivateTeacher's own comment) still owns
  // every submission they made; only the displayed name changes, matching
  // expense_record's profile_full_name() the same way.
  const submittedByName = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p.is_active ? p.full_name : "Teacher (Deleted)",
    ]),
  );

  // Both payment and edit submissions only store fee_account_id --
  // fee_account_record already carries every student/guardian/branch field
  // in one place (plus the fee account's own current values, which an edit
  // needs to diff against), so one batched fetch covers both instead of
  // querying per submission type.
  const feeAccountIds = Array.from(
    new Set([
      ...(payments.data ?? []).map((row) => row.fee_account_id),
      ...(edits.data ?? []).map((row) => row.fee_account_id),
    ]),
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
      actionType: "Student added",
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
    (row) => {
      const current = feeAccountById.get(row.fee_account_id);
      const changes = [
        diffField("Full name", current?.student_full_name, row.full_name),
        diffField(
          "Guardian",
          current?.student_guardian_name,
          row.guardian_name,
        ),
        diffField("Phone", current?.student_phone, row.phone),
        diffField("Grade", current?.class_section, row.class_section),
        diffField("Notes", current?.student_notes, row.notes),
        diffField(
          "Total receivable",
          current
            ? formatPaise(BigInt(current.total_receivable_paise ?? 0))
            : null,
          formatPaise(BigInt(row.total_receivable_paise)),
        ),
        diffField("Due date", current?.due_date, row.due_date),
        diffField("Starts on", current?.starts_on, row.starts_on),
        diffField("Ends on", current?.ends_on, row.ends_on),
        diffField("Fee account status", current?.status, row.fee_account_status),
        diffField("Route name", current?.route_name, row.route_name),
        diffField("Pickup point", current?.pickup_point, row.pickup_point),
        diffField("Slot", current?.slot, row.slot),
      ].filter((change): change is FieldChange => change !== null);

      return {
        table: "student_edit_submission",
        actionType: "Student edited",
        id: row.id,
        submittedAt: row.submitted_at,
        branchId: row.branch_id,
        summary: `Edit — ${row.full_name}`,
        detail: [
          {
            label: "Submitted by",
            value: submittedByName.get(row.submitted_by) ?? "",
          },
        ],
        changes,
      };
    },
  );

  const paymentRows: PendingPaymentSubmission[] = (payments.data ?? []).map(
    (row) => {
      const feeAccount = feeAccountById.get(row.fee_account_id);
      return {
        table: "payment_submission",
        actionType: "Payment recorded",
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

  const deleteRows: PendingStudentDeleteSubmission[] = (
    deletes.data ?? []
  ).map((row) => ({
    table: "student_delete_submission",
    actionType: "Deletion requested",
    id: row.id,
    submittedAt: row.submitted_at,
    branchId: row.branch_id,
    summary: `Delete — ${row.student_full_name}`,
    detail: [
      {
        label: "Submitted by",
        value: submittedByName.get(row.submitted_by) ?? "",
      },
      { label: "Student", value: row.student_full_name },
      { label: "Admission no.", value: row.student_admission_no },
    ],
  }));

  return [...studentRows, ...editRows, ...paymentRows, ...deleteRows].sort(
    (a, b) => a.submittedAt.localeCompare(b.submittedAt),
  );
}
