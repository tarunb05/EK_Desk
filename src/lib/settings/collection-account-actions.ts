"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import {
  createCollectionAccountSchema,
  setDefaultCollectionAccountSchema,
  updateCollectionAccountSchema,
} from "@/lib/settings/schemas";

export interface AffectedPaymentRequest {
  studentName: string;
  admissionNo: string;
  serviceType: string;
}

export interface CollectionAccountActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Populated when this save changed the UPI id/bank details of an account
  // with open requests against it -- those requests were just cancelled
  // (closed_reason = 'account_changed'), and these are the students whose
  // pay link a parent might still be holding. Re-sending is a 15.3 action;
  // this just surfaces who needs it.
  affected?: AffectedPaymentRequest[];
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

// save_collection_account (the 15.2 migration) raises a plain SQL exception
// for a wrong password or a not-admin caller -- everything else is an
// unexpected database error, which never surfaces as a raw Postgres string
// (CLAUDE.md) but as one generic sentence instead.
function messageForSaveError(error: { message: string }): string {
  if (error.message.includes("incorrect password")) {
    return "Incorrect password.";
  }
  return "Could not save this collection account.";
}

export async function createCollectionAccount(
  _prevState: CollectionAccountActionState,
  formData: FormData,
): Promise<CollectionAccountActionState> {
  await requireRole("admin");
  const parsed = createCollectionAccountSchema.safeParse(
    formEntries(formData),
  );
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_collection_account", {
    // p_id genuinely is nullable at the SQL level (create vs. update), but
    // Supabase's generated Args type doesn't model null for a required,
    // non-defaulted scalar parameter -- typed as plain `string` regardless.
    p_id: null as unknown as string,
    p_branch_id: value.branchId,
    p_label: value.label,
    p_upi_id: value.upiId,
    p_payee_name: value.payeeName,
    p_bank_name: value.bankName,
    p_account_holder: value.accountHolder,
    p_account_number: value.accountNumber,
    p_ifsc: value.ifsc,
    p_is_active: value.isActive,
    p_current_password: value.currentPassword,
  });

  if (error) {
    return { error: messageForSaveError(error) };
  }

  revalidatePath("/settings");
  // A brand-new account never has open requests against it yet, but the
  // function's shape is shared with the update path -- read affected the
  // same way for both rather than special-casing create.
  const affected = (data as { affected?: AffectedPaymentRequest[] })
    ?.affected;
  return { error: null, affected: affected?.length ? affected : undefined };
}

export async function updateCollectionAccount(
  _prevState: CollectionAccountActionState,
  formData: FormData,
): Promise<CollectionAccountActionState> {
  await requireRole("admin");
  const parsed = updateCollectionAccountSchema.safeParse(
    formEntries(formData),
  );
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_collection_account", {
    p_id: value.accountId,
    p_branch_id: value.branchId,
    p_label: value.label,
    p_upi_id: value.upiId,
    p_payee_name: value.payeeName,
    p_bank_name: value.bankName,
    p_account_holder: value.accountHolder,
    p_account_number: value.accountNumber,
    p_ifsc: value.ifsc,
    p_is_active: value.isActive,
    p_current_password: value.currentPassword,
  });

  if (error) {
    return { error: messageForSaveError(error) };
  }

  revalidatePath("/settings");
  const affected = (data as { affected?: AffectedPaymentRequest[] })
    ?.affected;
  return { error: null, affected: affected?.length ? affected : undefined };
}

export async function setDefaultCollectionAccount(
  _prevState: CollectionAccountActionState,
  formData: FormData,
): Promise<CollectionAccountActionState> {
  await requireRole("admin");
  const parsed = setDefaultCollectionAccountSchema.safeParse(
    formEntries(formData),
  );
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_default_collection_account", {
    p_id: parsed.data.accountId,
  });

  if (error) {
    return { error: "Could not set this as the default account." };
  }

  revalidatePath("/settings");
  return { error: null };
}
