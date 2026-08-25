import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000051";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000052";

describe("expense_record view (phase 10.3)", () => {
  let client: Client;
  let branchAId: string;
  let branchBId: string;
  let academicYearId: string;
  let categoryId: string;

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
    const category = await client.query<{ id: string }>(
      "select id from expense_category where name = 'Grocery' limit 1",
    );
    categoryId = category.rows[0]!.id;
  }

  it("resolves category, branch, and creator names, and shows unedited rows as not edited", async () => {
    await withRollback(client, async () => {
      await seedFixtures(client);
      await impersonateAdmin(client);
      const expense = await client.query<{ id: string }>(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values ($1, $2, $3, 50000, '2026-06-01', 'cash', $4)
         returning id`,
        [branchAId, academicYearId, categoryId, ADMIN_ID],
      );

      const row = await client.query(
        "select * from expense_record where id = $1",
        [expense.rows[0]!.id],
      );
      expect(row.rows[0]!.category_name).toBe("Grocery");
      expect(row.rows[0]!.branch_code).toBe("BR-A");
      expect(row.rows[0]!.created_by_name).toBe("Test Admin");
      expect(row.rows[0]!.updated_by_name).toBeNull();
      expect(row.rows[0]!.created_at).toEqual(row.rows[0]!.updated_at);
    });
  });

  it("reflects an edit with a different updated_by and a changed updated_at", async () => {
    await withRollback(client, async () => {
      await seedFixtures(client);
      await impersonateAdmin(client);
      const expense = await client.query<{ id: string }>(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values ($1, $2, $3, 50000, '2026-06-01', 'cash', $4)
         returning id`,
        [branchAId, academicYearId, categoryId, TEACHER_A_ID],
      );

      await client.query(
        `update expense set amount_paise = 60000, updated_by = $2, updated_at = now() + interval '1 minute' where id = $1`,
        [expense.rows[0]!.id, ADMIN_ID],
      );

      const row = await client.query(
        "select * from expense_record where id = $1",
        [expense.rows[0]!.id],
      );
      expect(row.rows[0]!.created_by_name).toBe("Test Teacher A");
      expect(row.rows[0]!.updated_by_name).toBe("Test Admin");
      expect(row.rows[0]!.created_at).not.toEqual(row.rows[0]!.updated_at);
    });
  });

  it("a teacher's read of expense_record stays branch-scoped, same as the raw table", async () => {
    await withRollback(client, async () => {
      await seedFixtures(client);
      await impersonateAdmin(client);
      await client.query(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values
           ($1, $2, $3, 10000, '2026-06-01', 'cash', $4),
           ($5, $2, $3, 20000, '2026-06-01', 'cash', $4)`,
        [branchAId, academicYearId, categoryId, ADMIN_ID, branchBId],
      );

      await client.query("reset role");
      await impersonate(client, TEACHER_A_ID);
      const rows = await client.query("select branch_code from expense_record");
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0]!.branch_code).toBe("BR-A");
    });
  });
});
