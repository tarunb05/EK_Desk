"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/require-role";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import {
  approveSubmissionSchema,
  archiveStudentSchema,
  createStudentWithFeeAccountSchema,
  recordPaymentSchema,
  rejectSubmissionSchema,
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
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
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

  const { error: feeAccountError } = await supabase.from("fee_account").insert({
    student_id: student.id,
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
  const parsed = archiveStudentSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("student")
    .update({ status: "inactive" })
    .eq("id", value.studentId);

  if (error) {
    return { error: "Could not delete this student." };
  }

  revalidatePath("/transport");
  revalidatePath("/daycare");
  redirect(value.redirectTo);
}

const APPROVE_RPC = {
  student_submission: "approve_student_submission",
  student_edit_submission: "approve_student_edit",
  payment_submission: "approve_payment_submission",
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
  redirect("/approvals");
}
