"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { usernameToInternalEmail } from "@/lib/auth/username";
import { fieldErrorsFromZod } from "@/lib/forms/field-errors";
import { normalizeCategoryName } from "@/lib/domain/expense-category-name";
import {
  createAcademicYearSchema,
  createBranchSchema,
  createExpenseCategorySchema,
  createTeacherSchema,
  deactivateTeacherSchema,
  deleteExpenseCategorySchema,
  deleteTeacherPermanentlySchema,
  reactivateTeacherSchema,
  renameExpenseCategorySchema,
  reorderExpenseCategorySchema,
  setExpenseCategoryActiveSchema,
  updateAcademicYearSchema,
  updateBranchSchema,
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

// Same two-step "unset, then set" as createAcademicYear -- the
// academic_year_one_current partial unique index (migration
// 20260822000000) is the actual guarantee, this ordering is just what
// keeps a normal save from tripping it. Unsetting excludes this row itself
// so re-saving an already-current year as current is a no-op, not a
// pointless unset-then-reset. Saving with isCurrent unchecked is allowed
// to leave zero years current -- the index only forbids more than one,
// and resolve-year-branch.ts already falls back to the most recent year
// when none is flagged.
export async function updateAcademicYear(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateAcademicYearSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const supabase = await createClient();

  if (value.isCurrent) {
    const { error: unsetError } = await supabase
      .from("academic_year")
      .update({ is_current: false })
      .eq("is_current", true)
      .neq("id", value.yearId);

    if (unsetError) {
      return { error: "Could not update the current academic year." };
    }
  }

  const { error } = await supabase
    .from("academic_year")
    .update({
      label: value.label,
      starts_on: value.startsOn,
      ends_on: value.endsOn,
      is_current: value.isCurrent,
    })
    .eq("id", value.yearId);

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

export async function updateBranch(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateBranchSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const value = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("branch")
    .update({
      code: value.code,
      name: value.name,
      is_active: value.isActive,
    })
    .eq("id", value.branchId);

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

// "Delete" on a teacher archives them rather than removing the row --
// student_submission/student_edit_submission/payment_submission.submitted_by,
// expense.created_by/updated_by, and activity_log.actor_id all reference
// profile with no on-delete action, by design, so a genuine
// adminClient.auth.admin.deleteUser() (which cascades auth.users -> profile)
// would throw a foreign-key violation the moment a teacher had added
// anything at all -- which is exactly the bug this replaces. Setting
// is_active false instead keeps every one of those rows, and every row
// they reference, completely untouched.
//
// This alone is also the whole "can't sign in again" mechanism: auth_role()/
// auth_branch_id() (security definer functions everything in the app reads
// role/branch through) filter on is_active, so a deactivated teacher
// resolves to no role at all the moment this commits -- middleware treats
// that identically to being signed out on their very next request, and
// login/actions.ts's signIn() catches it even earlier, at the login form
// itself, instead of letting a real password check succeed first.
export async function deactivateTeacher(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = deactivateTeacherSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Server is not configured to manage logins right now." };
  }

  // The Server Action itself is only ever wired to a "Delete" button
  // inside TeacherRow, which only ever renders for role = 'teacher'
  // profiles -- but this can in principle be invoked directly, and
  // profile_full_name()'s "Teacher (Deleted)" label (migration
  // 20260902000000) is only accurate for an actual teacher. Refuse
  // anything else outright rather than silently deactivating it.
  const { data: target } = await adminClient
    .from("profile")
    .select("role")
    .eq("id", parsed.data.teacherId)
    .maybeSingle();

  if (target?.role !== "teacher") {
    return { error: "Could not remove this teacher's access." };
  }

  // profile has no update policy for anyone (see role-based-rls migration)
  // -- role/branch/is_active changes go through the admin client, same as
  // updateTeacher above.
  const { error } = await adminClient
    .from("profile")
    .update({ is_active: false })
    .eq("id", parsed.data.teacherId);

  if (error) {
    return { error: "Could not remove this teacher's access." };
  }

  // Expenses and Approvals both show this teacher's name live (joined from
  // profile, not a frozen snapshot the way activity_log's actor_label is)
  // -- both need to pick up "Teacher (Deleted)" immediately, not just
  // Settings' own teacher list.
  revalidatePath("/settings");
  revalidatePath("/expenses");
  revalidatePath("/approvals");
  return { error: null };
}

// The reverse of deactivateTeacher -- restores exactly what deactivating
// took away (is_active), nothing else. Nothing about their profile,
// submissions, expenses, or activity log ever changed when they were
// deactivated in the first place, so there's nothing else to restore here.
export async function reactivateTeacher(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = reactivateTeacherSchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Server is not configured to manage logins right now." };
  }

  const { data: target } = await adminClient
    .from("profile")
    .select("role")
    .eq("id", parsed.data.teacherId)
    .maybeSingle();

  if (target?.role !== "teacher") {
    return { error: "Could not restore this teacher's access." };
  }

  const { error } = await adminClient
    .from("profile")
    .update({ is_active: true })
    .eq("id", parsed.data.teacherId);

  if (error) {
    return { error: "Could not restore this teacher's access." };
  }

  revalidatePath("/settings");
  revalidatePath("/expenses");
  revalidatePath("/approvals");
  return { error: null };
}

// A genuine, permanent delete -- only ever reachable once a teacher is
// already deactivated (TeacherRow only renders this action's button on an
// inactive row), as a deliberate safety buffer: archive first, decide to
// actually purge later, never straight from an active login. The
// is_active check below enforces that server-side too, not just in the UI.
//
// This can still fail: student_submission/student_edit_submission/
// payment_submission.submitted_by, expense.created_by/updated_by, and
// activity_log.actor_id all reference profile with no on-delete action, by
// design (see deactivateTeacher's own comment) -- so a teacher who's ever
// actually added anything (which, via log_activity()'s trigger, includes
// simply existing as the actor on an activity_log row) can't be purged
// this way. That's deliberate, not a bug: it's the same guarantee
// deactivateTeacher exists to make in the first place -- their work stays
// on record -- just enforced here as "can't delete" instead of "won't
// delete". The Admin API surfaces that as a generic error, not a
// structured Postgres code the way PostgREST does elsewhere in this app,
// so this can't distinguish it from any other failure -- one honest
// message covers both rather than guessing.
export async function deleteTeacherPermanently(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = deleteTeacherPermanentlySchema.safeParse(
    formEntries(formData),
  );
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return { error: "Server is not configured to manage logins right now." };
  }

  const { data: target } = await adminClient
    .from("profile")
    .select("role, is_active")
    .eq("id", parsed.data.teacherId)
    .maybeSingle();

  if (target?.role !== "teacher") {
    return { error: "Could not delete this login." };
  }
  if (target.is_active) {
    return { error: "Deactivate this teacher before deleting them." };
  }

  // profile has an on-delete-cascade FK to auth.users, so deleting the auth
  // user is the one action needed -- the profile row goes with it, if
  // nothing else references it first.
  const { error } = await adminClient.auth.admin.deleteUser(
    parsed.data.teacherId,
  );

  if (error) {
    return {
      error:
        "This teacher has added students, expenses, or payments and can't be permanently deleted — their access is already revoked.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/expenses");
  revalidatePath("/approvals");
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
      error:
        "Could not update your login — check the username isn't already used.",
    };
  }

  revalidatePath("/settings");
  return { error: null };
}

// /expenses has no page yet (that's phase 10.3) -- revalidating it now is
// inert but harmless, and saves having to remember to add it once the page
// exists. A renamed/reordered/deactivated category that still shows its old
// state there is exactly the kind of disagreement this app exists to avoid.
function revalidateExpenseCategoryDependents() {
  revalidatePath("/settings/expense-categories");
  revalidatePath("/expenses", "page");
}

async function findDuplicateCategoryName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase
    .from("expense_category")
    .select("id")
    // No wildcards in the pattern -- ilike with a plain string is an exact
    // case-insensitive match, exactly the "Grocery"/"grocery" check the
    // spec asks for.
    .ilike("name", name);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

export async function createExpenseCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = createExpenseCategorySchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const name = normalizeCategoryName(parsed.data.name);
  if (!name) {
    return { error: null, fieldErrors: { name: "Enter a category name." } };
  }
  const supabase = await createClient();

  if (await findDuplicateCategoryName(supabase, name)) {
    return { error: null, fieldErrors: { name: `"${name}" already exists.` } };
  }

  const { data: maxRow } = await supabase
    .from("expense_category")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from("expense_category")
    .insert({ name, sort_order: nextSortOrder });

  if (error) {
    return { error: "Could not save this category." };
  }

  revalidateExpenseCategoryDependents();
  return { error: null };
}

export async function renameExpenseCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = renameExpenseCategorySchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { categoryId } = parsed.data;
  const name = normalizeCategoryName(parsed.data.name);
  if (!name) {
    return { error: null, fieldErrors: { name: "Enter a category name." } };
  }
  const supabase = await createClient();

  if (await findDuplicateCategoryName(supabase, name, categoryId)) {
    return { error: null, fieldErrors: { name: `"${name}" already exists.` } };
  }

  const { error } = await supabase
    .from("expense_category")
    .update({ name })
    .eq("id", categoryId);

  if (error) {
    return { error: "Could not rename this category." };
  }

  revalidateExpenseCategoryDependents();
  return { error: null };
}

export async function setExpenseCategoryActive(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = setExpenseCategoryActiveSchema.safeParse(
    formEntries(formData),
  );
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("expense_category")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.categoryId);

  if (error) {
    return { error: "Could not update this category." };
  }

  revalidateExpenseCategoryDependents();
  return { error: null };
}

export async function reorderExpenseCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = reorderExpenseCategorySchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { categoryId, direction } = parsed.data;
  const supabase = await createClient();

  const { data: rows, error: readError } = await supabase
    .from("expense_category")
    .select("id, sort_order")
    .order("sort_order");

  if (readError || !rows) {
    return { error: "Could not reorder this category." };
  }

  const index = rows.findIndex((row) => row.id === categoryId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) {
    // Already at the top/bottom -- a clean no-op, not an error.
    return { error: null };
  }

  const current = rows[index]!;
  const swapWith = rows[swapIndex]!;

  const [{ error: firstError }, { error: secondError }] = await Promise.all([
    supabase
      .from("expense_category")
      .update({ sort_order: swapWith.sort_order })
      .eq("id", current.id),
    supabase
      .from("expense_category")
      .update({ sort_order: current.sort_order })
      .eq("id", swapWith.id),
  ]);

  if (firstError || secondError) {
    return { error: "Could not reorder this category." };
  }

  revalidateExpenseCategoryDependents();
  return { error: null };
}

export async function deleteExpenseCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const parsed = deleteExpenseCategorySchema.safeParse(formEntries(formData));
  if (!parsed.success) {
    return { error: null, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const supabase = await createClient();

  const { error } = await supabase
    .from("expense_category")
    .delete()
    .eq("id", parsed.data.categoryId);

  if (error) {
    // 23503 = foreign_key_violation -- the UI only offers delete when the
    // category has zero expenses, but that count can go stale between the
    // page render and this click, so on_delete_restrict is the real
    // guarantee here, not just the UI's own check.
    if (error.code === "23503") {
      return {
        error:
          "This category has expenses recorded against it — deactivate it instead.",
      };
    }
    return { error: "Could not delete this category." };
  }

  revalidateExpenseCategoryDependents();
  return { error: null };
}
