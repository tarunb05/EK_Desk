import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, impersonateAdmin, withRollback } from "./test-helpers";

describe("row level security", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterEach(async () => {
    await client.query("reset role");
  });

  afterAll(async () => {
    await client.end();
  });

  it("denies anon any access to student data", async () => {
    await client.query("set role anon");
    await expect(
      client.query("select 1 from student limit 1"),
    ).rejects.toThrow();
  });

  it("denies anon any access to the balance view", async () => {
    await client.query("set role anon");
    await expect(
      client.query("select 1 from fee_account_balance limit 1"),
    ).rejects.toThrow();
  });

  it("denies anon any access to payment data", async () => {
    await client.query("set role anon");
    await expect(
      client.query("select 1 from payment limit 1"),
    ).rejects.toThrow();
  });

  it("allows an admin to read student data", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const result = await client.query<{ count: number }>(
        "select count(*)::int as count from student",
      );
      expect(result.rows[0].count).toBeGreaterThan(0);
    });
  });

  it("allows an admin to read the balance view", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const result = await client.query<{ count: number }>(
        "select count(*)::int as count from fee_account_balance",
      );
      expect(result.rows[0].count).toBeGreaterThan(0);
    });
  });
});
