"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-role";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import {
  resolveSupportRequestSchema,
  submitSupportRequestSchema,
} from "@/lib/support/schemas";

export interface SupportActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
  submitted?: boolean;
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

export async function submitSupportRequest(
  _prevState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const parsed = submitSupportRequestSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const authed = await requireAuth();
  if (authed.role !== "teacher" || !authed.branchId) {
    return { error: "Only a teacher can send a support request." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("support_request").insert({
    branch_id: authed.branchId,
    submitted_by: authed.userId,
    message: parsed.data.message,
  });

  if (error) {
    return { error: "Could not send this — try again in a moment." };
  }

  revalidatePath("/support");
  return { error: null, submitted: true };
}

export async function resolveSupportRequest(
  _prevState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const parsed = resolveSupportRequestSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const authed = await requireAuth();
  if (authed.role !== "admin") {
    return { error: "Only an admin can resolve a support request." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_request")
    .update({
      status: "resolved",
      resolved_by: authed.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId)
    .eq("status", "open");

  if (error) {
    return { error: "Could not mark this resolved — try again in a moment." };
  }

  revalidatePath("/support");
  return { error: null };
}
