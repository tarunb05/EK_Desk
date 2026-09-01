import { Client } from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:54322/postgres";

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  return client;
}

// Wraps a test body in begin/rollback so fixture writes never persist and
// never disturb the seeded dataset other integration tests read from.
export async function withRollback<T>(
  client: Client,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    return await fn();
  } finally {
    await client.query("rollback");
  }
}

// Makes `auth.uid()` (and therefore auth_role()/auth_branch_id(), see the
// role-based-rls migration) resolve to a specific profile for the rest of
// the current transaction — `set role authenticated` alone, the pattern
// every pre-phase-8 test uses, carries no JWT claim and so no identity;
// role-aware tests need this too. set_config's third argument (`true`)
// scopes it to the transaction, same lifetime as `set role` inside
// withRollback.
export async function impersonate(
  client: Client,
  userId: string,
): Promise<void> {
  await client.query("set role authenticated");
  await client.query(
    "select set_config('request.jwt.claim.sub', $1, true)",
    [userId],
  );
}

const ADMIN_TEST_ID = "00000000-0000-4000-8000-00000000000a";

// Every test written before phase 8 does `set role authenticated` alone and
// expects the old blanket "authenticated full access" policies — those
// policies are gone (see the role-based-rls migration), so bare
// `authenticated` with no profile now correctly has no more access than
// anon. This is the direct replacement: seeds a well-known admin profile
// (idempotent, and rolled back with everything else inside withRollback)
// and impersonates it, so tests written against "authenticated == full
// access" keep testing exactly that, as an actual admin, instead of a role
// the app no longer has.
export async function impersonateAdmin(client: Client): Promise<void> {
  await client.query(
    "insert into auth.users (id) values ($1) on conflict (id) do nothing",
    [ADMIN_TEST_ID],
  );
  await client.query(
    `insert into profile (id, role, full_name) values ($1, 'admin', 'Test Admin')
     on conflict (id) do nothing`,
    [ADMIN_TEST_ID],
  );
  await impersonate(client, ADMIN_TEST_ID);
}
