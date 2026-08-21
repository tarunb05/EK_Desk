import { createClient } from "@supabase/supabase-js";
import { TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD } from "./test-credentials";
import { usernameToInternalEmail } from "../src/lib/auth/username";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run via --env-file=.env.local).",
  );
}

const email = usernameToInternalEmail(TEST_ADMIN_USERNAME);

async function main(supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing, error: listError } =
    await supabase.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }

  if (existing.users.some((user) => user.email === email)) {
    console.log(`Admin user ${TEST_ADMIN_USERNAME} already exists.`);
    return;
  }

  const { error: createError } = await supabase.auth.admin.createUser({
    email,
    password: TEST_ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (createError) {
    throw createError;
  }

  console.log(`Created admin user ${TEST_ADMIN_USERNAME}.`);
}

main(SUPABASE_URL, SERVICE_ROLE_KEY).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
