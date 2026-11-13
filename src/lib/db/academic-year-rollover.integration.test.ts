import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, withRollback } from "./test-helpers";

// roll_academic_year(date) is what the daily pg_cron job runs. These pass the
// date explicitly so 1 April 2027 can be tested without waiting for it.
describe("roll_academic_year", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  async function years() {
    const result = await client.query<{
      label: string;
      starts_on: string;
      ends_on: string;
      is_current: boolean;
    }>(
      `select label, starts_on::text, ends_on::text, is_current
       from academic_year
       where label in ('2026-27', '2027-28', '2028-29', '2099-00')
       order by starts_on`,
    );
    return result.rows;
  }

  it("creates the new year on 1 April and makes it current once the old one has ended", async () => {
    await withRollback(client, async () => {
      await client.query("select roll_academic_year('2027-04-01')");
      const rows = await years();
      const next = rows.find((r) => r.label === "2027-28");
      expect(next).toMatchObject({
        starts_on: "2027-04-01",
        ends_on: "2028-03-31",
        is_current: true,
      });
      expect(rows.find((r) => r.label === "2026-27")?.is_current).toBe(false);
      const current = await client.query(
        "select count(*)::int as n from academic_year where is_current",
      );
      expect(current.rows[0]!.n).toBe(1);
    });
  });

  it("treats January-March as part of the year that started the previous April", async () => {
    await withRollback(client, async () => {
      await client.query("select roll_academic_year('2028-02-15')");
      const rows = await years();
      expect(rows.some((r) => r.label === "2027-28")).toBe(true);
      expect(rows.some((r) => r.label === "2028-29")).toBe(false);
    });
  });

  it("leaves a year that is still running as current, and is safe to run twice", async () => {
    await withRollback(client, async () => {
      await client.query("select roll_academic_year('2026-11-13')");
      await client.query("select roll_academic_year('2026-11-13')");
      const rows = await years();
      expect(rows.find((r) => r.label === "2026-27")?.is_current).toBe(true);
      expect(rows.filter((r) => r.label === "2026-27")).toHaveLength(1);
    });
  });

  it("doesn't take a manually chosen current year away while it is still running", async () => {
    await withRollback(client, async () => {
      await client.query(
        "update academic_year set is_current = false where is_current",
      );
      await client.query(
        `insert into academic_year (label, starts_on, ends_on, is_current)
         values ('2028-29', '2028-04-01', '2029-03-31', true)`,
      );
      await client.query("select roll_academic_year('2027-04-01')");
      const rows = await years();
      expect(rows.find((r) => r.label === "2028-29")?.is_current).toBe(true);
    });
  });

  it("can't be called by the app's roles", async () => {
    await withRollback(client, async () => {
      await client.query("set role authenticated");
      await expect(
        client.query("select roll_academic_year('2027-04-01')"),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("is scheduled to run daily wherever pg_cron exists", async () => {
    // Supabase has pg_cron; CI's plain Postgres doesn't, and the migration
    // then leaves the job out. Either way is asserted, nothing is skipped.
    const installed = await client.query(
      "select 1 from pg_extension where extname = 'pg_cron'",
    );
    if (installed.rowCount === 0) {
      const schema = await client.query(
        "select 1 from information_schema.schemata where schema_name = 'cron'",
      );
      expect(schema.rowCount).toBe(0);
      return;
    }
    const job = await client.query<{ schedule: string; command: string }>(
      "select schedule, command from cron.job where jobname = 'roll-academic-year'",
    );
    expect(job.rows).toEqual([
      { schedule: "35 18 * * *", command: "select roll_academic_year()" },
    ]);
  });
});
