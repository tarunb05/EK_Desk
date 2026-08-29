"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/require-role";
import { setToastNotice } from "@/lib/shell/toast-cookie";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import { EXPENSE_SANITY_CEILING_PAISE } from "@/lib/domain/money";
import { isWithinAcademicYear } from "@/lib/domain/academic-year";
import {
  canTransitionStudentStatus,
  type StudentStatus,
} from "@/lib/domain/student-status";
import {
  approveSubmissionSchema,
  archiveStudentSchema,
  createStudentWithFeeAccountSchema,
  deleteExpenseSchema,
  permanentlyDeleteStudentSchema,
  recordExpenseSchema,
  recordPaymentSchema,
  rejectSubmissionSchema,
  requestStudentDeleteSchema,
  updateExpenseSchema,
  updateFeeAccountSchema,
  voidPaymentSchema,
} from "@/lib/records/schemas";

export interface ActionState {
  // A non-field-specific failure (a DB conflict, a permission check) --
  // shown once at the bottom of the form. Validation failures instead
  // populate fieldErrors, shown right next to the field that's wrong.
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Set instead of a redirect when a teacher's action lands in a pending
  // queue rather than taking effect immediately -- the form shows a
  // confirmation sentence rather than navigating away, since there's no
  // saved record yet to navigate to.
  submitted?: boolean;
  // Set instead of writing when a parsed amount exceeds the sanity ceiling
  // and the form hasn't re-submitted with confirmed=true yet -- the form
  // shows an explicit "confirm this large amount" step instead of either
  // silently writing it or hard-blocking it.
  confirmAmountPaise?: string;
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

// A student is one `student` row that can carry both a transport AND a
// daycare `fee_account` (CLAUDE.md rule 5) -- the same admission number is
// allowed to appear once per service, never twice in the same one. Looks up
// the existing student for this branch+admission number (if any) and, when
// found, whether they already have an active fee_account in the service
// being submitted. Shared by both the admin's direct-insert path and the
// teacher's submission path so the same admission number can't queue a
// second active transport (or daycare) account either.
async function findExistingStudentForAdmissionNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  admissionNo: string,
): Promise<
  | { error: string }
  | { student: null }
  | { student: { id: string; activeServiceTypes: string[] } }
> {
  const { data: student, error: studentLookupError } = await supabase
    .from("student")
    .select("id")
    .eq("branch_id", branchId)
    .eq("admission_no", admissionNo)
    .maybeSingle();

  if (studentLookupError) {
    return { error: "Could not check the admission number." };
  }
  if (!student) {
    return { student: null };
  }

  const { data: activeFeeAccounts, error: feeAccountLookupError } =
    await supabase
      .from("fee_account")
      .select("service_type")
      .eq("student_id", student.id)
      .eq("status", "active");

  if (feeAccountLookupError) {
    return { error: "Could not check the admission number." };
  }

  return {
    student: {
      id: student.id,
      activeServiceTypes: activeFeeAccounts.map((fa) => fa.service_type),
    },
  };
}

function duplicateServiceError(
  admissionNo: string,
  serviceType: string,
): ActionState {
  return {
    error: null,
    fieldErrors: {
      admissionNo: `Admission number ${admissionNo} already has an active ${serviceType} student.`,
    },
  };
}

export async function createStudentWithFeeAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createStudentWithFeeAccountSchema.safeParse(
    formEntries(formData),
  );
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const authed = await requireAuth();
  const supabase = await createClient();

  const existingLookup = await findExistingStudentForAdmissionNo(
    supabase,
    value.branchId,
    value.admissionNo,
  );
  if ("error" in existingLookup) {
    return { error: existingLookup.error };
  }
  if (
    existingLookup.student &&
    existingLookup.student.activeServiceTypes.includes(value.serviceType)
  ) {
    return duplicateServiceError(value.admissionNo, value.serviceType);
  }

  if (authed.role === "teacher") {
    // Never trust the submitted branchId over the caller's own profile,
    // even though RLS would also reject a mismatch -- this gives a
    // readable error instead of a generic "not saved" one.
    if (value.branchId !== authed.branchId) {
      return { error: "You can only add students for your own branch." };
    }

    const { error } = await supabase.from("student_submission").insert({
      branch_id: value.branchId,
      submitted_by: authed.userId,
      admission_no: value.admissionNo,
      full_name: value.fullName,
      guardian_name: value.guardianName,
      phone: value.phone,
      class_section: value.classSection,
      academic_year_id: value.academicYearId,
      service_type: value.serviceType,
      total_receivable_paise: Number(value.totalReceivable),
      due_date: value.dueDate,
      starts_on: value.startsOn,
      ends_on: value.endsOn,
      route_name:
        value.serviceType === "transport" ? (value.routeName ?? null) : null,
      pickup_point:
        value.serviceType === "transport" ? (value.pickupPoint ?? null) : null,
      slot: value.serviceType === "daycare" ? (value.slot ?? null) : null,
    });

    if (error) {
      return {
        error:
          "Could not submit this student — check the admission number isn't already queued.",
      };
    }

    revalidatePath("/students");
    return { error: null, submitted: true };
  }

  // Reuse the existing student row for this admission number if one exists
  // (already confirmed above to have no active fee_account in this service)
  // rather than inserting a second one -- a second row with the same
  // (branch_id, admission_no) would trip the DB's own
  // student_admission_no_unique_per_branch constraint, which is exactly the
  // case a student legitimately being enrolled in both transport and
  // daycare needs to succeed. The existing row's own name/guardian/phone
  // are left untouched here; this form isn't an edit of those fields.
  let studentId = existingLookup.student?.id;

  if (!studentId) {
    const { data: student, error: studentError } = await supabase
      .from("student")
      .insert({
        branch_id: value.branchId,
        admission_no: value.admissionNo,
        full_name: value.fullName,
        guardian_name: value.guardianName,
        phone: value.phone,
        class_section: value.classSection,
      })
      .select("id")
      .single();

    if (studentError || !student) {
      return {
        error:
          "Could not save the student — check the admission number isn't already used.",
      };
    }
    studentId = student.id;
  }

  const { error: feeAccountError } = await supabase.from("fee_account").insert({
    student_id: studentId,
    academic_year_id: value.academicYearId,
    service_type: value.serviceType,
    total_receivable_paise: Number(value.totalReceivable),
    due_date: value.dueDate,
    starts_on: value.startsOn,
    ends_on: value.endsOn,
    route_name:
      value.serviceType === "transport" ? (value.routeName ?? null) : null,
    pickup_point:
      value.serviceType === "transport" ? (value.pickupPoint ?? null) : null,
    slot: value.serviceType === "daycare" ? (value.slot ?? null) : null,
  });

  if (feeAccountError) {
    return { error: "Could not save the fee account." };
  }

  revalidatePath(`/${value.serviceType}`);
  revalidatePath("/students");
  await setToastNotice(`${value.fullName} added.`);
  redirect(`/${value.serviceType}`);
}

export async function updateFeeAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateFeeAccountSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const authed = await requireAuth();
  const supabase = await createClient();

  const { data: feeAccount, error: fetchError } = await supabase
    .from("fee_account")
    .select("service_type, student_id")
    .eq("id", value.feeAccountId)
    .single();

  if (fetchError || !feeAccount) {
    return { error: "Could not find that fee account." };
  }

  if (authed.role === "teacher") {
    if (!authed.branchId) {
      return { error: "Your account has no branch assigned — ask an admin." };
    }
    const { error } = await supabase.from("student_edit_submission").insert({
      student_id: feeAccount.student_id,
      fee_account_id: value.feeAccountId,
      branch_id: authed.branchId,
      submitted_by: authed.userId,
      full_name: value.fullName,
      guardian_name: value.guardianName,
      phone: value.phone,
      class_section: value.classSection,
      notes: value.notes ?? null,
      total_receivable_paise: Number(value.totalReceivable),
      due_date: value.dueDate,
      starts_on: value.startsOn,
      ends_on: value.endsOn,
      fee_account_status: value.status,
      route_name:
        feeAccount.service_type === "transport"
          ? (value.routeName ?? null)
          : null,
      pickup_point:
        feeAccount.service_type === "transport"
          ? (value.pickupPoint ?? null)
          : null,
      slot: feeAccount.service_type === "daycare" ? (value.slot ?? null) : null,
    });

    if (error) {
      return {
        error: "Could not submit this edit — is this student in your branch?",
      };
    }

    revalidatePath("/students");
    return { error: null, submitted: true };
  }

  const { error: studentError } = await supabase
    .from("student")
    .update({
      full_name: value.fullName,
      guardian_name: value.guardianName,
      phone: value.phone,
      class_section: value.classSection,
      notes: value.notes ?? null,
    })
    .eq("id", feeAccount.student_id);

  if (studentError) {
    return { error: "Could not update the student's details." };
  }

  const { error } = await supabase
    .from("fee_account")
    .update({
      total_receivable_paise: Number(value.totalReceivable),
      due_date: value.dueDate,
      starts_on: value.startsOn,
      ends_on: value.endsOn,
      status: value.status,
      route_name:
        feeAccount.service_type === "transport"
          ? (value.routeName ?? null)
          : null,
      pickup_point:
        feeAccount.service_type === "transport"
          ? (value.pickupPoint ?? null)
          : null,
      slot: feeAccount.service_type === "daycare" ? (value.slot ?? null) : null,
    })
    .eq("id", value.feeAccountId);

  if (error) {
    return { error: "Could not update the fee account." };
  }

  revalidatePath(`/${feeAccount.service_type}`);
  revalidatePath("/students");
  redirect(`/${feeAccount.service_type}`);
}

export async function recordPayment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = recordPaymentSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const authed = await requireAuth();
  const supabase = await createClient();

  const { data: feeAccount, error: fetchError } = await supabase
    .from("fee_account")
    .select("service_type")
    .eq("id", value.feeAccountId)
    .single();

  if (fetchError || !feeAccount) {
    return { error: "Could not find that fee account." };
  }

  if (authed.role === "teacher") {
    if (!authed.branchId) {
      return { error: "Your account has no branch assigned — ask an admin." };
    }
    const { error } = await supabase.from("payment_submission").insert({
      fee_account_id: value.feeAccountId,
      branch_id: authed.branchId,
      submitted_by: authed.userId,
      amount_paise: Number(value.amount),
      paid_on: value.paidOn,
      method: value.method,
      reference: value.reference ?? null,
      note: value.note ?? null,
    });

    if (error) {
      return {
        error: "Could not submit this payment — is this student in your branch?",
      };
    }

    revalidatePath("/students");
    return { error: null, submitted: true };
  }

  const { error } = await supabase.from("payment").insert({
    fee_account_id: value.feeAccountId,
    amount_paise: Number(value.amount),
    paid_on: value.paidOn,
    method: value.method,
    reference: value.reference ?? null,
    note: value.note ?? null,
    recorded_by: value.recordedBy,
  });

  if (error) {
    return { error: "Could not record the payment." };
  }

  revalidatePath(`/${feeAccount.service_type}`);
  revalidatePath("/students");
  redirect(`/${feeAccount.service_type}`);
}

export async function voidPayment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = voidPaymentSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;

  const supabase = await createClient();
  const { data: payment, error: fetchError } = await supabase
    .from("payment")
    .select("fee_account_id")
    .eq("id", value.paymentId)
    .single();

  if (fetchError || !payment) {
    return { error: "Could not find that payment." };
  }

  const { error } = await supabase
    .from("payment")
    .update({
      voided_at: new Date().toISOString(),
      void_reason: value.voidReason,
    })
    .eq("id", value.paymentId);

  if (error) {
    return { error: "Could not void the payment." };
  }

  const { data: feeAccount } = await supabase
    .from("fee_account")
    .select("service_type")
    .eq("id", payment.fee_account_id)
    .single();

  const serviceType = feeAccount?.service_type ?? "transport";
  revalidatePath(`/${serviceType}`);
  redirect(`/${serviceType}`);
}

// Soft delete: sets student.status = 'inactive' rather than removing the
// row. fee_account and payment rows are untouched — fee_account_record
// (what every listing/dashboard reads) excludes inactive students, but the
// student's own history is still reachable by id, and nothing is lost.
export async function archiveStudent(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // This action's only call site (DeleteStudentButton) lives on an
  // admin-only route already, but a Server Action is a public endpoint in
  // its own right -- route gating alone doesn't protect it if called
  // directly, so the check belongs here too.
  await requireRole("admin");

  const parsed = archiveStudentSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("student")
    .select("status")
    .eq("id", value.studentId)
    .single();

  if (readError || !current) {
    return { error: "Could not find this student." };
  }

  if (
    !canTransitionStudentStatus(current.status as StudentStatus, "inactive")
  ) {
    return {
      error: `This student is already ${current.status} and can't be deleted directly.`,
    };
  }

  const { error } = await supabase
    .from("student")
    .update({ status: "inactive" })
    .eq("id", value.studentId);

  if (error) {
    return { error: "Could not delete this student." };
  }

  revalidatePath("/transport");
  revalidatePath("/daycare");
  revalidatePath("/students");
  redirect(value.redirectTo);
}

// A genuinely different, additional action from archiveStudent above: this
// removes the row and everything referencing it (fee_account, payment) from
// the database entirely, no tombstone, via the on-delete-cascade added in
// the hard-delete-student migration. archiveStudent's soft delete
// (status = 'inactive', reversible, keeps history) stays exactly as it was.
export async function permanentlyDeleteStudent(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const parsed = permanentlyDeleteStudentSchema.safeParse(
    formEntries(formData),
  );
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("student")
    .delete({ count: "exact" })
    .eq("id", value.studentId);

  if (error) {
    return { error: "Could not delete this student." };
  }
  if (!count) {
    return { error: "This student no longer exists." };
  }

  revalidatePath("/students", "page");
  revalidatePath("/transport", "page");
  revalidatePath("/daycare", "page");
  return { error: null };
}

// A teacher's version of permanentlyDeleteStudent -- same underlying
// action, but a teacher can never do it directly (there's no grant path
// for that, and there shouldn't be for something this irreversible).
// Instead this queues a request an admin has to approve, same
// submit/approve shape as add/edit/payment. requireAuth (not requireRole)
// since an admin never needs this path -- they already have the direct one.
export async function requestStudentDelete(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestStudentDeleteSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const authed = await requireAuth();
  const supabase = await createClient();

  // Re-read the student server-side rather than trust a client-supplied
  // name/admission number for the denormalized display fields, and to
  // confirm it's actually in the teacher's own branch before queuing
  // anything (RLS enforces this too, but this gives a readable error
  // instead of a generic "not saved" one).
  const { data: student, error: readError } = await supabase
    .from("student")
    .select("full_name, admission_no, branch_id")
    .eq("id", value.studentId)
    .single();

  if (readError || !student) {
    return { error: "Could not find this student." };
  }

  if (authed.role === "teacher" && student.branch_id !== authed.branchId) {
    return { error: "You can only request deletion for your own branch." };
  }

  const { error } = await supabase.from("student_delete_submission").insert({
    student_id: value.studentId,
    branch_id: student.branch_id,
    submitted_by: authed.userId,
    student_full_name: student.full_name,
    student_admission_no: student.admission_no,
  });

  if (error) {
    return {
      error:
        "Could not submit this delete request — it may already be queued.",
    };
  }

  revalidatePath("/students", "page");
  revalidatePath("/approvals");
  return { error: null, submitted: true };
}

const APPROVE_RPC = {
  student_submission: "approve_student_submission",
  student_edit_submission: "approve_student_edit",
  payment_submission: "approve_payment_submission",
  student_delete_submission: "approve_student_delete",
} as const;

export async function approveSubmission(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = approveSubmissionSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { submissionTable, submissionId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc(APPROVE_RPC[submissionTable], {
    p_id: submissionId,
  });

  if (error) {
    return {
      error: "Could not approve this — it may have already been reviewed.",
    };
  }

  revalidatePath("/approvals");
  revalidatePath("/transport");
  revalidatePath("/daycare");
  revalidatePath("/students");
  redirect("/approvals");
}

export async function rejectSubmission(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = rejectSubmissionSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { submissionTable, submissionId, reviewNote } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from(submissionTable)
    .update({
      status: "rejected",
      review_note: reviewNote,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending");

  if (error) {
    return { error: "Could not reject this submission." };
  }

  revalidatePath("/approvals");
  return { error: null };
}

async function resolveExpenseBranchAndYear(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authed: Awaited<ReturnType<typeof requireAuth>>,
  value: { branchId?: string; academicYearId: string; spentOn: string },
): Promise<{ branchId: string } | { error: string; field?: string }> {
  let branchId: string;
  if (authed.role === "teacher") {
    if (!authed.branchId) {
      return { error: "Your account has no branch assigned — ask an admin." };
    }
    branchId = authed.branchId;
  } else {
    if (!value.branchId) {
      return { error: "Choose a branch.", field: "branchId" };
    }
    branchId = value.branchId;
  }

  const { data: year, error: yearError } = await supabase
    .from("academic_year")
    .select("label, starts_on, ends_on")
    .eq("id", value.academicYearId)
    .single();

  if (yearError || !year) {
    return { error: "Could not find that academic year." };
  }

  if (
    !isWithinAcademicYear(new Date(value.spentOn), {
      startsOn: new Date(year.starts_on),
      endsOn: new Date(year.ends_on),
    })
  ) {
    return {
      error: `${value.spentOn} falls outside the ${year.label} academic year.`,
      field: "spentOn",
    };
  }

  return { branchId };
}

export async function recordExpense(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = recordExpenseSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const authed = await requireAuth();
  const supabase = await createClient();

  const resolved = await resolveExpenseBranchAndYear(supabase, authed, value);
  if ("error" in resolved) {
    return resolved.field
      ? { error: null, fieldErrors: { [resolved.field]: resolved.error } }
      : { error: resolved.error };
  }

  if (
    value.amount > EXPENSE_SANITY_CEILING_PAISE &&
    value.confirmed !== "true"
  ) {
    return { error: null, confirmAmountPaise: value.amount.toString() };
  }

  const { error } = await supabase.from("expense").insert({
    branch_id: resolved.branchId,
    academic_year_id: value.academicYearId,
    category_id: value.categoryId,
    amount_paise: Number(value.amount),
    spent_on: value.spentOn,
    method: value.method,
    reference: value.reference ?? null,
    note: value.note ?? null,
    created_by: authed.userId,
  });

  if (error) {
    return { error: "Could not record this expense." };
  }

  revalidatePath("/expenses", "page");
  await setToastNotice("Expense recorded.");
  redirect("/expenses");
}

export async function updateExpense(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateExpenseSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const authed = await requireAuth();
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("expense")
    .select("branch_id")
    .eq("id", value.expenseId)
    .single();

  if (fetchError || !existing) {
    return { error: "Could not find that expense." };
  }

  // Re-checked on the way in (this row must already be the teacher's own
  // branch -- RLS would also block the read otherwise, this just gives a
  // readable error instead of a bare "not found") and, by never letting
  // branch_id appear in a teacher's update payload below, on the way out --
  // a teacher can edit any field on a row in their branch but can never
  // move it to another one.
  if (authed.role === "teacher") {
    if (!authed.branchId || existing.branch_id !== authed.branchId) {
      return { error: "You can only edit expenses in your own branch." };
    }
  }

  const resolved = await resolveExpenseBranchAndYear(supabase, authed, value);
  if ("error" in resolved) {
    return resolved.field
      ? { error: null, fieldErrors: { [resolved.field]: resolved.error } }
      : { error: resolved.error };
  }

  if (
    value.amount > EXPENSE_SANITY_CEILING_PAISE &&
    value.confirmed !== "true"
  ) {
    return { error: null, confirmAmountPaise: value.amount.toString() };
  }

  const { error } = await supabase
    .from("expense")
    .update({
      academic_year_id: value.academicYearId,
      category_id: value.categoryId,
      amount_paise: Number(value.amount),
      spent_on: value.spentOn,
      method: value.method,
      reference: value.reference ?? null,
      note: value.note ?? null,
      updated_by: authed.userId,
      updated_at: new Date().toISOString(),
      // Only admin's payload can move a row to another branch.
      ...(authed.role === "admin" ? { branch_id: resolved.branchId } : {}),
    })
    .eq("id", value.expenseId);

  if (error) {
    return { error: "Could not save this expense." };
  }

  revalidatePath("/expenses", "page");
  redirect("/expenses");
}

// No approval queue, unlike a student delete -- per CLAUDE.md rule 10, an
// expense creates no receivable and settles no account, so gating this
// behind approval would be ceremony, not safety. Admin and teacher (own
// branch, enforced by RLS below) both delete directly; the
// expense_delete_log row is the audit trail rule 8 calls for, since
// there's no soft-delete flag or shadow history table to look at after.
export async function deleteExpense(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteExpenseSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: "Could not find that expense." };
  }
  const { expenseId } = parsed.data;
  const authed = await requireAuth();
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("expense")
    .select("branch_id, category_id, amount_paise")
    .eq("id", expenseId)
    .single();

  if (fetchError || !existing) {
    return { error: "Could not find that expense." };
  }

  // Same shape as updateExpense's own check -- RLS would block the delete
  // regardless, this just turns it into a readable error instead of a
  // silent "0 rows affected."
  if (authed.role === "teacher") {
    if (!authed.branchId || existing.branch_id !== authed.branchId) {
      return { error: "You can only delete expenses in your own branch." };
    }
  }

  // Logged before the delete, not after -- if the delete then fails, an
  // orphaned log entry for a still-existing expense is a harmless no-op
  // to notice; a successful delete with no log entry at all is the actual
  // hole in the audit trail this exists to prevent.
  const { error: logError } = await supabase.from("expense_delete_log").insert({
    expense_id: expenseId,
    category_id: existing.category_id,
    amount_paise: existing.amount_paise,
    actor: authed.userId,
  });
  if (logError) {
    return { error: "Could not delete this expense." };
  }

  const { error } = await supabase.from("expense").delete().eq("id", expenseId);
  if (error) {
    return { error: "Could not delete this expense." };
  }

  revalidatePath("/expenses", "page");
  return { error: null };
}
