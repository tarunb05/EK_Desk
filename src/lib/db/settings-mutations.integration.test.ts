import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, impersonateAdmin, withRollback } from "./test-helpers";

describe("settings mutations (as authenticated)", () => {
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

  it("lets an authenticated user insert a new academic year", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);

      const result = await client.query(
        `insert into academic_year (label, starts_on, ends_on, is_current)
         values ('2099-2100', '2099-04-01', '2100-03-31', false)
         returning id`,
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  it("lets an authenticated user insert a new branch", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);

      const result = await client.query(
        `insert into branch (code, name, is_active)
         values ('BR-TEST', 'Test Branch', true)
         returning id`,
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  it("rejects a second current academic year (partial unique index)", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);

      // The seeded dataset already has one is_current = true row — inserting
      // a second one must violate academic_year_one_current.
      await expect(
        client.query(
          `insert into academic_year (label, starts_on, ends_on, is_current)
           values ('2098-2099', '2098-04-01', '2099-03-31', true)`,
        ),
      ).rejects.toThrow();
    });
  });

  it("allows flipping current to a different year once the old one is unset", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);

      await client.query(
        "update academic_year set is_current = false where is_current = true",
      );

      const result = await client.query(
        `insert into academic_year (label, starts_on, ends_on, is_current)
         values ('2098-2099', '2098-04-01', '2099-03-31', true)
         returning id`,
      );

      expect(result.rows).toHaveLength(1);
    });
  });
});
