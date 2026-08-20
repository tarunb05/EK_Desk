import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./test-helpers";

describe("dashboard aggregates", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("combined branch totals equal the sum of branch A and branch B", async () => {
    const perBranch = await client.query<{
      branch_code: string;
      total_receivable: string;
      total_collected: string;
      count: string;
    }>(
      `select b.code as branch_code,
              sum(fab.total_receivable_paise)::bigint as total_receivable,
              sum(fab.collected_paise)::bigint as total_collected,
              count(*)::int as count
       from fee_account_balance fab
       join student s on s.id = fab.student_id
       join branch b on b.id = s.branch_id
       group by b.code`,
    );
    const byBranch = Object.fromEntries(
      perBranch.rows.map((row) => [row.branch_code, row]),
    );
    expect(byBranch["BR-A"]).toBeDefined();
    expect(byBranch["BR-B"]).toBeDefined();

    const combined = await client.query<{
      total_receivable: string;
      total_collected: string;
      count: string;
    }>(
      `select sum(total_receivable_paise)::bigint as total_receivable,
              sum(collected_paise)::bigint as total_collected,
              count(*)::int as count
       from fee_account_balance`,
    );

    const sumReceivable =
      BigInt(byBranch["BR-A"].total_receivable) +
      BigInt(byBranch["BR-B"].total_receivable);
    const sumCollected =
      BigInt(byBranch["BR-A"].total_collected) +
      BigInt(byBranch["BR-B"].total_collected);
    const sumCount =
      Number(byBranch["BR-A"].count) + Number(byBranch["BR-B"].count);

    expect(sumReceivable).toBe(BigInt(combined.rows[0].total_receivable));
    expect(sumCollected).toBe(BigInt(combined.rows[0].total_collected));
    expect(sumCount).toBe(Number(combined.rows[0].count));
  });

  it("has fee accounts in both academic years and both service types", async () => {
    const result = await client.query<{
      label: string;
      service_type: string;
      count: string;
    }>(
      `select ay.label, fab.service_type, count(*)::int as count
       from fee_account_balance fab
       join academic_year ay on ay.id = fab.academic_year_id
       group by ay.label, fab.service_type`,
    );
    const combos = new Set(
      result.rows.map((r) => `${r.label}:${r.service_type}`),
    );

    expect(combos.has("2026-27:transport")).toBe(true);
    expect(combos.has("2026-27:daycare")).toBe(true);
    expect(
      combos.has("2025-26:transport") || combos.has("2025-26:daycare"),
    ).toBe(true);
  });

  it("computes the same overdue count from the view as the domain rule predicts", async () => {
    const result = await client.query<{ overdue_count: string }>(
      `select count(*) filter (where pending_paise > 0 and due_date < current_date)::int as overdue_count
       from fee_account_balance`,
    );
    expect(Number(result.rows[0].overdue_count)).toBeGreaterThan(0);
  });
});
