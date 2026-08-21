import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ageingBucket } from "../domain/overdue";
import { connect, withRollback } from "./test-helpers";

describe("dashboard RPC functions", () => {
  let client: Client;
  let currentYearId: string;

  beforeAll(async () => {
    client = await connect();
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current = true limit 1",
    );
    currentYearId = year.rows[0]!.id;
  });

  afterAll(async () => {
    await client.end();
  });

  it("dashboard_summary totals agree with a direct sum over fee_account_record", async () => {
    const summary = await client.query<{
      student_count: string;
      total_receivable_paise: string;
      total_collected_paise: string;
      total_pending_paise: string;
      total_overdue_paise: string;
    }>("select * from dashboard_summary($1, $2, null)", [
      "transport",
      currentYearId,
    ]);

    const direct = await client.query<{
      student_count: string;
      total_receivable_paise: string;
      total_collected_paise: string;
      total_pending_paise: string;
    }>(
      `select count(distinct student_id) as student_count,
              coalesce(sum(total_receivable_paise), 0) as total_receivable_paise,
              coalesce(sum(collected_paise), 0) as total_collected_paise,
              coalesce(sum(pending_paise), 0) as total_pending_paise
       from fee_account_record
       where service_type = 'transport' and academic_year_id = $1`,
      [currentYearId],
    );

    expect(summary.rows[0]!.student_count).toBe(direct.rows[0]!.student_count);
    expect(summary.rows[0]!.total_receivable_paise).toBe(
      direct.rows[0]!.total_receivable_paise,
    );
    expect(summary.rows[0]!.total_collected_paise).toBe(
      direct.rows[0]!.total_collected_paise,
    );
    expect(summary.rows[0]!.total_pending_paise).toBe(
      direct.rows[0]!.total_pending_paise,
    );
  });

  it("branch-scoped summaries sum to the combined (null branch) summary", async () => {
    const combined = await client.query<{ total_receivable_paise: string }>(
      "select * from dashboard_summary($1, $2, null)",
      ["transport", currentYearId],
    );
    const branchA = await client.query<{ total_receivable_paise: string }>(
      "select * from dashboard_summary($1, $2, $3)",
      ["transport", currentYearId, "BR-A"],
    );
    const branchB = await client.query<{ total_receivable_paise: string }>(
      "select * from dashboard_summary($1, $2, $3)",
      ["transport", currentYearId, "BR-B"],
    );

    const sum =
      BigInt(branchA.rows[0]!.total_receivable_paise) +
      BigInt(branchB.rows[0]!.total_receivable_paise);
    expect(sum).toBe(BigInt(combined.rows[0]!.total_receivable_paise));
  });

  it("dashboard_ageing_buckets agrees with the unit-tested ageingBucket for every account", async () => {
    const accounts = await client.query<{
      pending_paise: string;
      due_date: string;
    }>(
      `select pending_paise, due_date::text
       from fee_account_record
       where service_type = 'transport' and academic_year_id = $1`,
      [currentYearId],
    );

    const asOf = new Date();
    const expectedCounts = new Map<string, number>();
    for (const row of accounts.rows) {
      const bucket = ageingBucket(
        BigInt(row.pending_paise),
        new Date(row.due_date),
        asOf,
      );
      expectedCounts.set(bucket, (expectedCounts.get(bucket) ?? 0) + 1);
    }

    const buckets = await client.query<{
      bucket: string;
      account_count: string;
    }>("select * from dashboard_ageing_buckets($1, $2, null)", [
      "transport",
      currentYearId,
    ]);

    for (const row of buckets.rows) {
      expect(Number(row.account_count)).toBe(
        expectedCounts.get(row.bucket) ?? 0,
      );
    }
  });

  it("dashboard_collection_by_month sums to the same total as dashboard_summary", async () => {
    const summary = await client.query<{ total_collected_paise: string }>(
      "select * from dashboard_summary($1, $2, null)",
      ["transport", currentYearId],
    );
    const byMonth = await client.query<{ collected_paise: string }>(
      "select * from dashboard_collection_by_month($1, $2, null)",
      ["transport", currentYearId],
    );

    const sum = byMonth.rows.reduce(
      (total, row) => total + BigInt(row.collected_paise),
      0n,
    );
    expect(sum).toBe(BigInt(summary.rows[0]!.total_collected_paise));
  });

  it("dashboard_breakdown_by_class sums to the same receivable as dashboard_summary", async () => {
    const summary = await client.query<{ total_receivable_paise: string }>(
      "select * from dashboard_summary($1, $2, null)",
      ["transport", currentYearId],
    );
    const byClass = await client.query<{ receivable_paise: string }>(
      "select * from dashboard_breakdown_by_class($1, $2, null)",
      ["transport", currentYearId],
    );

    const sum = byClass.rows.reduce(
      (total, row) => total + BigInt(row.receivable_paise),
      0n,
    );
    expect(sum).toBe(BigInt(summary.rows[0]!.total_receivable_paise));
  });

  it("discontinuing a fee account removes it from dashboard_summary but keeps it in fee_account_record history", async () => {
    await withRollback(client, async () => {
      const target = await client.query<{
        id: string;
        total_receivable_paise: string;
      }>(
        `select id, total_receivable_paise
         from fee_account
         where service_type = 'transport'
           and academic_year_id = $1
           and status = 'active'
         limit 1`,
        [currentYearId],
      );
      const feeAccountId = target.rows[0]!.id;
      const receivablePaise = BigInt(target.rows[0]!.total_receivable_paise);

      const before = await client.query<{ total_receivable_paise: string }>(
        "select * from dashboard_summary($1, $2, null)",
        ["transport", currentYearId],
      );

      await client.query(
        "update fee_account set status = 'discontinued' where id = $1",
        [feeAccountId],
      );

      const after = await client.query<{ total_receivable_paise: string }>(
        "select * from dashboard_summary($1, $2, null)",
        ["transport", currentYearId],
      );

      expect(BigInt(before.rows[0]!.total_receivable_paise)).toBe(
        BigInt(after.rows[0]!.total_receivable_paise) + receivablePaise,
      );

      const history = await client.query(
        "select fee_account_id from fee_account_record where fee_account_id = $1",
        [feeAccountId],
      );
      expect(history.rows).toHaveLength(1);
    });
  });

  it("dashboard_breakdown_by_group sums to the same receivable as dashboard_summary", async () => {
    const summary = await client.query<{ total_receivable_paise: string }>(
      "select * from dashboard_summary($1, $2, null)",
      ["transport", currentYearId],
    );
    const byGroup = await client.query<{ receivable_paise: string }>(
      "select * from dashboard_breakdown_by_group($1, $2, null)",
      ["transport", currentYearId],
    );

    const sum = byGroup.rows.reduce(
      (total, row) => total + BigInt(row.receivable_paise),
      0n,
    );
    expect(sum).toBe(BigInt(summary.rows[0]!.total_receivable_paise));
  });
});
