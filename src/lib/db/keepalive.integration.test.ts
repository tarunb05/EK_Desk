import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, withRollback } from "./test-helpers";

// keepalive() is what the scheduled workflow calls with only the public anon
// key, so it has to work as anon and must not open up anything else.
describe("keepalive", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("returns 1 to an anonymous caller", async () => {
    await withRollback(client, async () => {
      await client.query("set role anon");
      const result = await client.query<{ keepalive: number }>(
        "select keepalive()",
      );
      expect(result.rows[0]!.keepalive).toBe(1);
    });
  });

  it("gives an anonymous caller no access to student data", async () => {
    await withRollback(client, async () => {
      await client.query("set role anon");
      await expect(
        client.query("select 1 from student limit 1"),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});
