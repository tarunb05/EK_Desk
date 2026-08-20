import { Client } from "pg";

export const TEST_DATABASE_URL =
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
