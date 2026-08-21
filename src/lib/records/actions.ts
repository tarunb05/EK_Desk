"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  archiveStudentSchema,
  createStudentWithFeeAccountSchema,
  recordPaymentSchema,
  updateFeeAccountSchema,
  voidPaymentSchema,
} from "@/lib/records/schemas";

export interface ActionState {
  error: string | null;
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
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  const value = parsed.data;

  const supabase = await createClient();

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
  redirect(`/${value.serviceType}`);
}

export async function updateFeeAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateFeeAccountSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  const value = parsed.data;

  const supabase = await createClient();
  const { data: feeAccount, error: fetchError } = await supabase
    .from("fee_account")
    .select("service_type")
    .eq("id", value.feeAccountId)
    .single();

  if (fetchError || !feeAccount) {
    return { error: "Could not find that fee account." };
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
  redirect(`/${feeAccount.service_type}`);
}

export async function recordPayment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = recordPaymentSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }
  const value = parsed.data;

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
    reference: value.reference ?? null,
    note: value.note ?? null,
    recorded_by: value.recordedBy,
  });

  if (error) {
    return { error: "Could not record the payment." };
  }

  revalidatePath(`/${feeAccount.service_type}`);
  redirect(`/${feeAccount.service_type}`);
}

export async function voidPayment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = voidPaymentSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
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
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
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
