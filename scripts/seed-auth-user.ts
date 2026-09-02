import { createClient } from "@supabase/supabase-js";
import {
  TEST_ADMIN_USERNAME,
  TEST_ADMIN_PASSWORD,
  TEST_TEACHERS,
} from "./test-credentials";
import { usernameToInternalEmail } from "../src/lib/auth/username";
import type { Database } from "../src/lib/supabase/database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run via --env-file=.env.local).",
  );
}

type SupabaseAdmin = ReturnType<typeof createClient<Database>>;

// Creates the auth user if it doesn't exist yet, and either way returns its
// id -- callers upsert a matching `profile` row afterward regardless of
// which branch this took, since a migration-time backfill only covers
// users that already existed when that migration ran, never ones created
// by this script afterward (this script always runs after `db reset`).
async function ensureAuthUser(
  supabase: SupabaseAdmin,
  email: string,
  password: string,
): Promise<string> {
  const { data: existing, error: listError } =
    await supabase.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }

  const found = existing.users.find((user) => user.email === email);
  if (found) {
    return found.id;
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (createError || !created.user) {
    throw createError ?? new Error(`Could not create user ${email}.`);
  }

  return created.user.id;
}

async function main(supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const adminEmail = usernameToInternalEmail(TEST_ADMIN_USERNAME);
  const adminId = await ensureAuthUser(supabase, adminEmail, TEST_ADMIN_PASSWORD);
  const { error: adminProfileError } = await supabase.from("profile").upsert({
    id: adminId,
    role: "admin",
    full_name: "Admin",
  });
  if (adminProfileError) {
    throw adminProfileError;
  }
  console.log(`Admin user ${TEST_ADMIN_USERNAME} ready.`);

  for (const teacher of TEST_TEACHERS) {
    const { data: branch, error: branchError } = await supabase
      .from("branch")
      .select("id")
      .eq("code", teacher.branchCode)
      .single();
    if (branchError || !branch) {
      throw (
        branchError ??
        new Error(`Branch ${teacher.branchCode} not found -- seed it first.`)
      );
    }

    const email = usernameToInternalEmail(teacher.username);
    const teacherId = await ensureAuthUser(supabase, email, teacher.password);
    const { error: teacherProfileError } = await supabase
      .from("profile")
      .upsert({
        id: teacherId,
        role: "teacher",
        branch_id: branch.id,
        full_name: teacher.fullName,
      });
    if (teacherProfileError) {
      throw teacherProfileError;
    }
    console.log(
      `Teacher ${teacher.username} (${teacher.branchCode}) ready.`,
    );
  }
}

main(SUPABASE_URL, SERVICE_ROLE_KEY).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
