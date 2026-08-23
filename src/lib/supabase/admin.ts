import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

// Service-role client -- bypasses RLS entirely. Creating a login is only
// possible through the Admin API, which needs this key; profile also has no
// insert/update policy for anyone (see the role-based-rls migration), so
// writing the new teacher's profile row goes through this same client.
// Every caller must already have gone through requireRole("admin") first --
// this file has no authorization check of its own.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required to create a teacher login.",
    );
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey);
}
