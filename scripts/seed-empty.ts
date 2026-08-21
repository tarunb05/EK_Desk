import { Client } from "pg";

// Same branch/academic-year reference data as scripts/seed.ts, but with no
// students, fee accounts, or payments — a clean slate for trying the app
// against real data instead of Faker-generated fixtures. scripts/seed.ts
// itself is left untouched: integration tests and CI assert exact totals
// against its deterministic fake dataset (faker.seed(42)), so it can't
// double as this "start blank" path.

const DATABASE_URL =
  process.env.SEED_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:54322/postgres";

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  await client.query("begin");
  try {
    await client.query(
      "truncate table payment, fee_account, student, academic_year, branch restart identity cascade",
    );

    await client.query(
      `insert into branch (code, name, is_active) values
        ('BR-A', 'Kothanur', true),
        ('BR-B', 'Kannuru', true)`,
    );

    await client.query(
      `insert into academic_year (label, starts_on, ends_on, is_current) values
        ('2025-26', '2025-04-01', '2026-03-31', false),
        ('2026-27', '2026-04-01', '2027-03-31', true)`,
    );

    await client.query("commit");
    console.log(
      "Reset to blank: branches and academic years only, no students/fee accounts/payments.",
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
