import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./test-helpers";

describe("filter and sort", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("orders rows by pending_paise descending", async () => {
    const result = await client.query<{ pending_paise: string }>(
      `select pending_paise from fee_account_balance
       where service_type = 'transport'
       order by pending_paise desc
       limit 20`,
    );
    const values = result.rows.map((row) => BigInt(row.pending_paise));
    expect(values.length).toBeGreaterThan(1);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]! <= values[i - 1]!).toBe(true);
    }
  });

  it("orders rows by pending_paise ascending", async () => {
    const result = await client.query<{ pending_paise: string }>(
      `select pending_paise from fee_account_balance
       where service_type = 'transport'
       order by pending_paise asc
       limit 20`,
    );
    const values = result.rows.map((row) => BigInt(row.pending_paise));
    expect(values.length).toBeGreaterThan(1);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]! >= values[i - 1]!).toBe(true);
    }
  });

  it("filters to only the requested service_type", async () => {
    const result = await client.query<{ service_type: string }>(
      "select service_type from fee_account_balance where service_type = 'daycare'",
    );
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.service_type).toBe("daycare");
    }
  });

  it("filters to only the requested branch", async () => {
    const result = await client.query<{ code: string }>(
      `select b.code from fee_account_balance fab
       join student s on s.id = fab.student_id
       join branch b on b.id = s.branch_id
       where b.code = 'BR-A'`,
    );
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.code).toBe("BR-A");
    }
  });
});
