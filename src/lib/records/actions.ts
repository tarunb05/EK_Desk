"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/require-role";
import type { Role } from "@/lib/auth/routes";
import { setToastNotice } from "@/lib/shell/toast-cookie";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import { EXPENSE_SANITY_CEILING_PAISE } from "@/lib/domain/money";
import {
  academicYearContaining,
  isWithinAcademicYear,
} from "@/lib/domain/academic-year";
import { getAcademicYears } from "@/lib/supabase/queries";
import { formatLogDate } from "@/lib/domain/datetime";
import { enrollmentsOverlap } from "@/lib/domain/enrollment-period";
import { enrollmentLabel } from "@/lib/domain/enrollment-label";
import {
  canTransitionStudentStatus,
  type StudentStatus,
} from "@/lib/domain/student-status";
import {
  approveSubmissionSchema,
  archiveStudentSchema,
  createStudentWithFeeAccountSchema,
  deleteEnrollmentSchema,
  requestEnrollmentDeleteSchema,
  initialPaymentSchema,
  type InitialPayment,
  deleteExpenseSchema,
  permanentlyDeleteStudentSchema,
  recordExpenseSchema,
  recordPaymentSchema,
  reEnrollStudentSchema,
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

// Postgres's exclusion_violation -- raised by fee_account_daycare_no_overlap
// when two active daycare accounts for one student would cover the same day.
const EXCLUSION_VIOLATION = "23P01";

// Where a save lands: the service's dashboard for an admin; the Students
// page for a teacher, since /transport and /daycare are admin-only routes.
function afterSaveRoute(role: Role, serviceType: string): string {
  return role === "teacher" ? "/students" : `/${serviceType}`;
}

const DAYCARE_OVERLAP_ERROR =
  "These dates overlap another daycare enrollment for this student.";

// payment_reference_unique_upi_non_voided (20260919000000) rejects a UPI
// reference already on another non-voided payment.
function isDuplicateUpiReference(error: { code: string; message: string }) {
  return (
    error.code === "23505" &&
    error.message.includes("payment_reference_unique_upi_non_voided")
  );
}

interface ActiveFeeAccount {
  service_type: string;
  starts_on: string;
  ends_on: string;
}

// A student is one `student` row that can carry both a transport AND a
// daycare `fee_account` (CLAUDE.md rule 5). Transport allows one active
// account per student; daycare allows several, as long as their dates
// don't overlap (fee_account_daycare_no_overlap enforces the same rule in
// the database). Looks up the existing student for this branch+admission
// number (if any) and, when found, their active fee_accounts.
async function findExistingStudentForAdmissionNo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  admissionNo: string,
): Promise<
  | { error: string }
  | { student: null }
  | { student: { id: string; activeAccounts: ActiveFeeAccount[] } }
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
      .select("service_type, starts_on, ends_on")
      .eq("student_id", student.id)
      .eq("status", "active");

  if (feeAccountLookupError) {
    return { error: "Could not check the admission number." };
  }

  return { student: { id: student.id, activeAccounts: activeFeeAccounts } };
}

// Returns the form error for a new enrollment that would duplicate an
// existing one, or null when it's fine to add.
function duplicateEnrollmentError(
  activeAccounts: ActiveFeeAccount[],
  value: {
    admissionNo: string;
    serviceType: string;
    startsOn: string;
    endsOn: string;
  },
): ActionState | null {
  const sameService = activeAccounts.filter(
    (account) => account.service_type === value.serviceType,
  );
  if (value.serviceType === "transport") {
    return sameService.length > 0
      ? duplicateServiceError(value.admissionNo, value.serviceType)
      : null;
  }
  const overlapping = sameService.find((account) =>
    enrollmentsOverlap(
      { startsOn: account.starts_on, endsOn: account.ends_on },
      value,
    ),
  );
  if (!overlapping) return null;
  return {
    error: null,
    fieldErrors: {
      startsOn: `This student is already enrolled in daycare from ${formatLogDate(overlapping.starts_on)} to ${formatLogDate(overlapping.ends_on)}. Pick dates that don't overlap.`,
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
      admissionNo: `A ${serviceType} student with admission number ${admissionNo} already exists.`,
    },
  };
}

// Reads the optional "Paid" section of an enrollment form: not ticked is no
// payment and no errors; ticked but incomplete is field errors to show.
function parseInitialPayment(raw: Record<string, string>): {
  payment: InitialPayment | null;
  errors: Record<string, string>;
} {
  if (raw.paid !== "on") return { payment: null, errors: {} };
  const parsed = initialPaymentSchema.safeParse(raw);
  return parsed.success
    ? { payment: parsed.data, errors: {} }
    : { payment: null, errors: fieldErrorsFromZod(parsed.error) };
}

function paymentTooLargeError(
  payment: InitialPayment | null,
  totalReceivable: bigint,
): ActionState | null {
  if (!payment || payment.paidAmount <= totalReceivable) return null;
  return {
    error: null,
    fieldErrors: {
      paidAmount: "The amount paid can't be more than Total receivable.",
    },
  };
}

// Records the "Paid" part of an enrollment form against the enrollment just
// saved, under the signed-in person's name. On failure `reason` is a phrase
// to splice into the message (empty when the cause isn't one we can name).
async function recordInitialPayment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  feeAccountId: string,
  payment: InitialPayment,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: profile } = await supabase
    .from("profile")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await supabase.from("payment").insert({
    fee_account_id: feeAccountId,
    amount_paise: Number(payment.paidAmount),
    paid_on: payment.paidOn,
    method: payment.paidMethod,
    // `|| null`, not `??` -- see recordPayment.
    reference: payment.paidReference || null,
    recorded_by: profile?.full_name ?? "Admin",
  });
  if (!error) return { ok: true };
  return {
    ok: false,
    reason: isDuplicateUpiReference(error)
      ? ": that UPI reference is already on another payment"
      : "",
  };
}

export async function createStudentWithFeeAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formEntries(formData);
  const parsed = createStudentWithFeeAccountSchema.safeParse(raw);
  const { payment, errors: paymentErrors } = parseInitialPayment(raw);
  if (!parsed.success) {
    const fieldErrors = {
      ...paymentErrors,
      ...fieldErrorsFromZod(parsed.error),
    };
    // The schema's own superRefine (pickupPoint required for transport,
    // slot required for daycare) only fires when the rest of the object
    // already parsed cleanly -- Zod skips a superRefine's checks once any
    // sibling field has already failed, so a transport submission missing
    // BOTH, say, Total receivable and Pickup point silently dropped the
    // Pickup point error entirely, showing only one of the two problems.
    // Re-checked here directly against the raw field, independent of
    // whatever else on the form is or isn't valid.
    if (
      raw.serviceType === "transport" &&
      !fieldErrors.pickupPoint &&
      !raw.pickupPoint?.trim()
    ) {
      fieldErrors.pickupPoint = "Enter a pickup point.";
    }
    if (
      raw.serviceType === "daycare" &&
      !fieldErrors.slot &&
      !raw.slot?.trim()
    ) {
      fieldErrors.slot = "Choose a slot.";
    }
    return { error: null, fieldErrors };
  }
  if (Object.keys(paymentErrors).length > 0) {
    return { error: null, fieldErrors: paymentErrors };
  }
  const value = parsed.data;
  const tooMuch = paymentTooLargeError(payment, value.totalReceivable);
  if (tooMuch) return tooMuch;
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
  if (existingLookup.student) {
    const duplicate = duplicateEnrollmentError(
      existingLookup.student.activeAccounts,
      value,
    );
    if (duplicate) return duplicate;
  }

  // Never trust the submitted branchId over the caller's own profile, even
  // though RLS would also reject a mismatch -- this gives a readable error
  // instead of a generic "not saved" one.
  if (authed.role === "teacher" && value.branchId !== authed.branchId) {
    return { error: "You can only add students for your own branch." };
  }

  // Reuse the existing student row for this admission number if one exists
  // (already confirmed above not to duplicate an enrollment in this service)
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
        whatsapp_phone: value.whatsappPhone || null,
        class_section: value.classSection,
        notes: value.notes ?? null,
      })
      .select("id")
      .single();

    if (studentError || !student) {
      return {
        error:
          "Could not save the student. Check the admission number isn't already used.",
      };
    }
    studentId = student.id;
  }

  const { data: feeAccount, error: feeAccountError } = await supabase
    .from("fee_account")
    .insert({
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
    })
    .select("id")
    .single();

  if (feeAccountError || !feeAccount) {
    // Only reachable if another enrollment was saved between the check
    // above and this insert.
    if (feeAccountError?.code === EXCLUSION_VIOLATION) {
      return { error: null, fieldErrors: { startsOn: DAYCARE_OVERLAP_ERROR } };
    }
    return { error: "Could not save the fee account." };
  }

  if (payment) {
    const recorded = await recordInitialPayment(
      supabase,
      authed.userId,
      feeAccount.id,
      payment,
    );
    // The student and enrollment are already saved at this point, so say
    // exactly that rather than a failure that invites adding them twice.
    if (!recorded.ok) {
      revalidatePath(`/${value.serviceType}`);
      revalidatePath("/students");
      return {
        error: `${value.fullName} was added, but the payment couldn't be recorded${recorded.reason}. Record it from their student page instead of adding them again.`,
      };
    }
  }

  revalidatePath(`/${value.serviceType}`);
  revalidatePath("/students");
  await setToastNotice(`${value.fullName} added.`);
  redirect(afterSaveRoute(authed.role, value.serviceType));
}

// A returning daycare student books another stint: a new fee_account on the
// same student row, so nothing about them is re-entered and every earlier
// enrollment and payment stays exactly as it was. The same overlap rule as
// adding applies (no two active daycare stints may share a day).
export async function reEnrollStudent(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formEntries(formData);
  const parsed = reEnrollStudentSchema.safeParse(raw);
  const { payment, errors: paymentErrors } = parseInitialPayment(raw);
  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: { ...paymentErrors, ...fieldErrorsFromZod(parsed.error) },
    };
  }
  if (Object.keys(paymentErrors).length > 0) {
    return { error: null, fieldErrors: paymentErrors };
  }
  const value = parsed.data;
  const tooMuch = paymentTooLargeError(payment, value.totalReceivable);
  if (tooMuch) return tooMuch;

  const authed = await requireAuth();
  const supabase = await createClient();

  // RLS already limits a teacher to their own branch's students.
  const { data: student } = await supabase
    .from("student")
    .select(
      "id, full_name, admission_no, status, guardian_name, phone, whatsapp_phone, class_section, notes",
    )
    .eq("id", value.studentId)
    .maybeSingle();
  if (!student) return { error: "Could not find that student." };
  if (student.status !== "active") {
    return {
      error: `${student.full_name} isn't an active student (${student.status}), so they can't be re-enrolled.`,
    };
  }

  const { data: activeAccounts, error: lookupError } = await supabase
    .from("fee_account")
    .select("service_type, starts_on, ends_on")
    .eq("student_id", student.id)
    .eq("status", "active");
  if (lookupError) {
    return { error: "Could not check this student's current enrollments." };
  }
  const overlap = duplicateEnrollmentError(activeAccounts, {
    admissionNo: student.admission_no,
    serviceType: "daycare",
    startsOn: value.startsOn,
    endsOn: value.endsOn,
  });
  if (overlap) return overlap;

  // The form is pre-filled from the student's record, so anything changed on
  // the way through is a correction to it -- saved here like the edit form
  // does, but only when something actually differs, so a re-enrollment with
  // no corrections doesn't add a no-op student update to the activity log.
  const details = {
    full_name: value.fullName,
    guardian_name: value.guardianName,
    phone: value.phone,
    whatsapp_phone: value.whatsappPhone || null,
    class_section: value.classSection,
    notes: value.notes || null,
  };
  const detailsChanged =
    details.full_name !== student.full_name ||
    details.guardian_name !== student.guardian_name ||
    details.phone !== student.phone ||
    details.whatsapp_phone !== (student.whatsapp_phone || null) ||
    details.class_section !== student.class_section ||
    details.notes !== (student.notes || null);
  if (detailsChanged) {
    const { error: studentError } = await supabase
      .from("student")
      .update(details)
      .eq("id", student.id);
    if (studentError) {
      return { error: "Could not update the student's details." };
    }
  }

  // The stint belongs to the academic year it starts in; the year the form
  // came from is only the fallback for a start date in a gap between years.
  const years = await getAcademicYears(supabase);
  const year = academicYearContaining(value.startsOn, years);

  const { data: feeAccount, error: feeAccountError } = await supabase
    .from("fee_account")
    .insert({
      student_id: student.id,
      academic_year_id: year?.id ?? value.academicYearId,
      service_type: "daycare",
      total_receivable_paise: Number(value.totalReceivable),
      due_date: value.dueDate,
      starts_on: value.startsOn,
      ends_on: value.endsOn,
      slot: value.slot,
    })
    .select("id")
    .single();
  if (feeAccountError || !feeAccount) {
    // Only reachable if another stint was saved between the check above and
    // this insert.
    if (feeAccountError?.code === EXCLUSION_VIOLATION) {
      return { error: null, fieldErrors: { startsOn: DAYCARE_OVERLAP_ERROR } };
    }
    return { error: "Could not save the re-enrollment." };
  }

  if (payment) {
    const recorded = await recordInitialPayment(
      supabase,
      authed.userId,
      feeAccount.id,
      payment,
    );
    if (!recorded.ok) {
      revalidatePath("/students");
      revalidatePath(`/students/student/${student.id}`);
      return {
        error: `${value.fullName} was re-enrolled, but the payment couldn't be recorded${recorded.reason}. Record it from the Actions menu instead of re-enrolling again.`,
      };
    }
  }

  revalidatePath("/students");
  revalidatePath("/daycare");
  revalidatePath(`/students/student/${student.id}`);
  await setToastNotice(`${value.fullName} re-enrolled.`);
  redirect(`/students/student/${student.id}`);
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

  const { error: studentError } = await supabase
    .from("student")
    .update({
      full_name: value.fullName,
      guardian_name: value.guardianName,
      phone: value.phone,
      whatsapp_phone: value.whatsappPhone || null,
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
    if (error.code === EXCLUSION_VIOLATION) {
      return { error: null, fieldErrors: { startsOn: DAYCARE_OVERLAP_ERROR } };
    }
    return { error: "Could not update the fee account." };
  }

  revalidatePath(`/${feeAccount.service_type}`);
  revalidatePath("/students");
  redirect(afterSaveRoute(authed.role, feeAccount.service_type));
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

  const { error } = await supabase.from("payment").insert({
    fee_account_id: value.feeAccountId,
    amount_paise: Number(value.amount),
    paid_on: value.paidOn,
    method: value.method,
    // `|| null`, not `??` -- a blank field parses as "" (a valid,
    // non-nullish string), which a unique index treats as a real, colliding
    // value, unlike NULL.
    reference: value.reference || null,
    note: value.note ?? null,
    recorded_by: value.recordedBy,
  });

  if (error) {
    return { error: "Could not record the payment." };
  }

  revalidatePath(`/${feeAccount.service_type}`);
  revalidatePath("/students");
  redirect(afterSaveRoute(authed.role, feeAccount.service_type));
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
  const authed = await requireAuth();
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
  revalidatePath("/students");
  redirect(afterSaveRoute(authed.role, serviceType));
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

  // Phase 15.5: money that arrived should never silently disappear from
  // the record, the same way a payment row itself never can -- this now
  // goes through hard_delete_student, which blocks the delete outright if
  // the student has a confirmed payment claim on record, rather than the
  // raw table delete this used to be.
  const { error } = await supabase.rpc("hard_delete_student", {
    p_student_id: value.studentId,
  });

  if (error) {
    return {
      error: error.message.includes("confirmed payment")
        ? "This student has a confirmed payment on record and can't be deleted."
        : error.message.includes("no longer exists")
          ? "This student no longer exists."
          : "Could not delete this student.",
    };
  }

  revalidatePath("/students", "page");
  revalidatePath("/transport", "page");
  revalidatePath("/daycare", "page");
  return { error: null };
}

// Removes ONE enrollment -- its payments and payment requests go with it --
// and leaves the student and their other enrollments alone. Admin only, and
// refused for an enrollment with a confirmed payment claim, exactly like
// deleting the whole student (hard_delete_fee_account in the database). A
// teacher gets no version of this: to retire an enrollment without losing
// its history they can set it to Discontinued from Edit.
export async function deleteEnrollment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const parsed = deleteEnrollmentSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const supabase = await createClient();

  const { error } = await supabase.rpc("hard_delete_fee_account", {
    p_fee_account_id: parsed.data.feeAccountId,
  });

  if (error) {
    return {
      error: error.message.includes("confirmed payment")
        ? "This enrollment has a confirmed payment on record and can't be deleted."
        : error.message.includes("no longer exists")
          ? "This enrollment no longer exists."
          : "Could not delete this enrollment.",
    };
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
      error: "Could not submit this delete request. It may already be queued.",
    };
  }

  revalidatePath("/students", "page");
  revalidatePath("/approvals");
  return { error: null, submitted: true };
}

// A teacher's version of deleteEnrollment: queues a request for an admin to
// approve (approve_enrollment_delete does the actual delete). The enrollment
// is re-read server-side so the names and label stored with the request come
// from the database, not the client, and so a teacher can only ask about an
// enrollment in their own branch.
export async function requestEnrollmentDelete(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestEnrollmentDeleteSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const authed = await requireAuth();
  const supabase = await createClient();

  const { data: account, error: readError } = await supabase
    .from("fee_account")
    .select(
      "id, service_type, starts_on, ends_on, status, academic_year(label), student(full_name, admission_no, branch_id)",
    )
    .eq("id", parsed.data.feeAccountId)
    .single();

  if (readError || !account || !account.student) {
    return { error: "Could not find this enrollment." };
  }

  if (
    authed.role === "teacher" &&
    account.student.branch_id !== authed.branchId
  ) {
    return { error: "You can only request deletion for your own branch." };
  }

  const { error } = await supabase.from("enrollment_delete_submission").insert({
    fee_account_id: account.id,
    branch_id: account.student.branch_id,
    submitted_by: authed.userId,
    student_full_name: account.student.full_name,
    student_admission_no: account.student.admission_no,
    enrollment_label: enrollmentLabel({
      serviceType: account.service_type,
      academicYearLabel: account.academic_year?.label ?? "",
      startsOn: account.starts_on,
      endsOn: account.ends_on,
      status: account.status,
    }),
  });

  if (error) {
    return {
      error: "Could not submit this delete request. It may already be queued.",
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
  enrollment_delete_submission: "approve_enrollment_delete",
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
    if (error.code === EXCLUSION_VIOLATION) {
      return {
        error: `Could not approve this: ${DAYCARE_OVERLAP_ERROR.toLowerCase()} Reject it or change the other enrollment first.`,
      };
    }
    if (error.message.includes("confirmed payment")) {
      return {
        error:
          "Could not approve this. The enrollment has a confirmed payment on record and can't be deleted. Reject the request instead.",
      };
    }
    if (isDuplicateUpiReference(error)) {
      return {
        error:
          "Could not approve this. Its UPI reference is already on another payment. Reject it and ask for the correct reference.",
      };
    }
    return {
      error: "Could not approve this. It may have already been reviewed.",
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
      return { error: "Your account has no branch assigned. Ask an admin." };
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
