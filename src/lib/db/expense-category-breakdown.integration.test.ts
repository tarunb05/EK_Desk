import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000061";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000062";

describe("expense_category_breakdown (phase 10.4)", () => {
  let client: Client;
  let branchAId: string;
  let branchBId: string;
  let academicYearId: string;
  let groceryId: string;
  let fuelId: string;

  beforeAll(async () => {
    client = await connect();
  });

  afterEach(async () => {
    await client.query("reset role");
  });

  afterAll(async () => {
    await client.end();
  });

  async function seedFixtures(client: Client) {
    await client.query(
      `insert into auth.users (id) values ($1), ($2) on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_A_ID],
    );
    const branchA = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-A' limit 1",
    );
    branchAId = branchA.rows[0]!.id;
    const branchB = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-B' limit 1",
    );
    branchBId = branchB.rows[0]!.id;
    await client.query(
      `insert into profile (id, role, branch_id, full_name) values
         ($1, 'admin', null, 'Test Admin'),
         ($2, 'teacher', $3, 'Test Teacher A')`,
      [ADMIN_ID, TEACHER_A_ID, branchAId],
    );
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current = true limit 1",
    );
    academicYearId = year.rows[0]!.id;
    const grocery = await client.query<{ id: string }>(
      "select id from expense_category where name = 'Grocery' limit 1",
    );
    groceryId = grocery.rows[0]!.id;
    const fuel = await client.query<{ id: string }>(
      "select id from expense_category where name = 'Fuel' limit 1",
    );
    fuelId = fuel.rows[0]!.id;
  }

  it("sums per-category amounts correctly across a mixed multi-category, multi-branch fixture", async () => {
    await withRollback(client, async () => {
      await seedFixtures(client);
      await impersonateAdmin(client);
      await client.query(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values
           ($1, $2, $3, 10000, '2026-06-01', 'cash', $5),
           ($1, $2, $3, 5000, '2026-06-02', 'cash', $5),
           ($1, $2, $4, 30000, '2026-06-03', 'cash', $5),
           ($6, $2, $3, 99999, '2026-06-04', 'cash', $5)`,
        [branchAId, academicYearId, groceryId, fuelId, ADMIN_ID, branchBId],
      );

      const result = await client.query<{
        category_name: string;
        amount_paise: string;
      }>("select category_name, amount_paise from expense_category_breakdown($1, $2)", [
        academicYearId,
        "BR-A",
      ]);

      const byName = new Map(
        result.rows.map((r) => [r.category_name, Number(r.amount_paise)]),
      );
      expect(byName.get("Grocery")).toBe(15000);
      expect(byName.get("Fuel")).toBe(30000);
      // BR-B's row must not be included when scoped to BR-A.
      expect(result.rowCount).toBe(2);
    });
  });

  it("a category with nothing spent in this year/branch doesn't appear", async () => {
    await withRollback(client, async () => {
      await seedFixtures(client);
      await impersonateAdmin(client);
      await client.query(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values ($1, $2, $3, 10000, '2026-06-01', 'cash', $4)`,
        [branchAId, academicYearId, groceryId, ADMIN_ID],
      );

      const result = await client.query<{ category_name: string }>(
        "select category_name from expense_category_breakdown($1, $2)",
        [academicYearId, "BR-A"],
      );
      expect(result.rows.map((r) => r.category_name)).toEqual(["Grocery"]);
    });
  });

  it("a teacher's call is scoped to their own branch by RLS, even with p_branch_code left null", async () => {
    await withRollback(client, async () => {
      await seedFixtures(client);
      await impersonateAdmin(client);
      await client.query(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values
           ($1, $2, $3, 10000, '2026-06-01', 'cash', $4),
           ($5, $2, $3, 50000, '2026-06-01', 'cash', $4)`,
        [branchAId, academicYearId, groceryId, ADMIN_ID, branchBId],
      );

      await client.query("reset role");
      await impersonate(client, TEACHER_A_ID);
      // Deliberately pass no branch filter (null) -- RLS, not the
      // parameter, must be what keeps this scoped to the teacher's branch.
      const result = await client.query<{ amount_paise: string }>(
        "select amount_paise from expense_category_breakdown($1, null)",
        [academicYearId],
      );
      expect(result.rowCount).toBe(1);
      expect(Number(result.rows[0]!.amount_paise)).toBe(10000);
    });
  });
});
