"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { usernameToInternalEmail } from "@/lib/auth/username";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import {
  createAcademicYearSchema,
  createBranchSchema,
  createTeacherSchema,
  deleteTeacherSchema,
  updateOwnCredentialsSchema,
  updateTeacherSchema,
} from "@/lib/settings/schemas";

export interface ActionState {
  error: string | null;
  fieldErrors?: Record<string, string>;
}

function formEntries(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}

// Every screen that reads years/branches (dashboards, the student directory,
// the add-student forms) lives under one of these three layouts — revalidate
// the whole layout subtree rather than each page individually, so a new
// /transport/new or /daycare/[feeAccountId] doesn't silently need its own
// entry added here later.
function revalidateScopeDependents() {
  revalidatePath("/transport", "layout");
  revalidatePath("/daycare", "layout");
  revalidatePath("/students");
  revalidatePath("/settings");
}

export async function createAcademicYear(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createAcademicYearSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const supabase = await createClient();

  if (value.isCurrent) {
    const { error: unsetError } = await supabase
      .from("academic_year")
      .update({ is_current: false })
      .eq("is_current", true);

    if (unsetError) {
      return { error: "Could not update the current academic year." };
    }
  }

  const { error } = await supabase.from("academic_year").insert({
    label: value.label,
    starts_on: value.startsOn,
    ends_on: value.endsOn,
    is_current: value.isCurrent,
  });

  if (error) {
    return {
      error:
        "Could not save the academic year — check the label isn't already used.",
    };
  }

  revalidateScopeDependents();
  return { error: null };
}

export async function createBranch(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createBranchSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("branch").insert({
    code: value.code,
    name: value.name,
  });

  if (error) {
    return {
      error: "Could not save the branch — check the code isn't already used.",
    };
  }

  revalidateScopeDependents();
  return { error: null };
}

// Creating a login is only possible through the Supabase Admin API, which
// needs the service-role key -- this is the one place in the running app
// that key is ever used (everywhere else relies on RLS through the
// caller's own session). requireRole("admin") gates it in addition to
// /settings already being an admin-only route, since this Server Action
// could in principle be invoked directly.
export async function createTeacher(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = createTeacherSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Server is not configured to create logins right now." };
  }

  const email = usernameToInternalEmail(value.username);

  // GoTrue hashes the password (bcrypt) before it's ever written to
  // auth.users -- this app never sees or stores the plaintext password
  // itself past this call.
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password: value.password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    return {
      error:
        "Could not create this login — check the username isn't already used.",
    };
  }

  const { error: profileError } = await adminClient.from("profile").upsert({
    id: created.user.id,
    role: "teacher",
    branch_id: value.branchId,
    full_name: value.fullName,
  });

  if (profileError) {
    return {
      error: "Login created, but could not save the teacher's profile.",
    };
  }

  revalidatePath("/settings");
  return { error: null };
}

export async function updateTeacher(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = updateTeacherSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Server is not configured to manage logins right now." };
  }

  const authUpdate: { email: string; password?: string } = {
    email: usernameToInternalEmail(value.username),
  };
  if (value.newPassword) {
    authUpdate.password = value.newPassword;
  }

  const { error: authError } = await adminClient.auth.admin.updateUserById(
    value.teacherId,
    authUpdate,
  );
  if (authError) {
    return {
      error:
        "Could not update this login — check the username isn't already used.",
    };
  }

  const { error: profileError } = await adminClient
    .from("profile")
    .update({ full_name: value.fullName, branch_id: value.branchId })
    .eq("id", value.teacherId);

  if (profileError) {
    return {
      error: "Login updated, but could not save the teacher's profile.",
    };
  }

  revalidatePath("/settings");
  return { error: null };
}

export async function deleteTeacher(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = deleteTeacherSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Server is not configured to manage logins right now." };
  }

  // profile has an on-delete-cascade FK to auth.users, so deleting the auth
  // user is the one action needed -- the profile row goes with it.
  const { error } = await adminClient.auth.admin.deleteUser(
    parsed.data.teacherId,
  );
  if (error) {
    return { error: "Could not delete this login." };
  }

  revalidatePath("/settings");
  return { error: null };
}

// An admin editing their own username/password -- same Admin API call as
// editing a teacher, just targeted at the caller's own id instead of one
// chosen from a list. Changing email/password this way doesn't invalidate
// the admin's current session (confirmed empirically renaming the seed
// admin account earlier), so this doesn't need to sign anyone out.
export async function updateOwnCredentials(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const authed = await requireRole("admin");
  const parsed = updateOwnCredentialsSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Server is not configured to manage logins right now." };
  }

  const authUpdate: { email: string; password?: string } = {
    email: usernameToInternalEmail(value.username),
  };
  if (value.newPassword) {
    authUpdate.password = value.newPassword;
  }

  const { error } = await adminClient.auth.admin.updateUserById(
    authed.userId,
    authUpdate,
  );
  if (error) {
    return {
      error: "Could not update your login — check the username isn't already used.",
    };
  }

  revalidatePath("/settings");
  return { error: null };
}
