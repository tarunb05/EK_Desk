import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000041";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000042";
const TEACHER_A2_ID = "00000000-0000-4000-8000-000000000044";
const TEACHER_B_ID = "00000000-0000-4000-8000-000000000043";

describe("expense tracker (phase 10.1 -- schema and authorization)", () => {
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

  beforeEach(async () => {
    const branchA = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-A' limit 1",
    );
    branchAId = branchA.rows[0]!.id;
    const branchB = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-B' limit 1",
    );
    branchBId = branchB.rows[0]!.id;
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current = true limit 1",
    );
    academicYearId = year.rows[0]!.id;
    const category = await client.query<{ id: string }>(
      "select id from expense_category where name = 'Grocery' limit 1",
    );
    categoryId = category.rows[0]!.id;
  });

  async function seedProfiles(client: Client) {
    await client.query(
      `insert into auth.users (id) values ($1), ($2), ($3), ($4)
       on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_A_ID, TEACHER_B_ID, TEACHER_A2_ID],
    );
    await client.query(
      `insert into profile (id, role, branch_id, full_name) values
         ($1, 'admin', null, 'Test Admin'),
         ($2, 'teacher', $5, 'Test Teacher A'),
         ($3, 'teacher', $6, 'Test Teacher B'),
         ($4, 'teacher', $5, 'Test Teacher A2')`,
      [ADMIN_ID, TEACHER_A_ID, TEACHER_B_ID, TEACHER_A2_ID, branchAId, branchBId],
    );
  }

  async function insertExpense(
    client: Client,
    overrides: {
      branchId: string;
      createdBy: string;
      amountPaise?: number;
    },
  ) {
    return client.query<{ id: string }>(
      `insert into expense
         (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
       values ($1, $2, $3, $4, '2026-06-01', 'cash', $5)
       returning id`,
      [
        overrides.branchId,
        academicYearId,
        categoryId,
        overrides.amountPaise ?? 50000,
        overrides.createdBy,
      ],
    );
  }

  it("a teacher can insert an expense in their own branch, landing with created_by = auth.uid()", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const result = await insertExpense(client, {
        branchId: branchAId,
        createdBy: TEACHER_A_ID,
      });
      expect(result.rowCount).toBe(1);

      const row = await client.query<{ created_by: string }>(
        "select created_by from expense where id = $1",
        [result.rows[0]!.id],
      );
      expect(row.rows[0]!.created_by).toBe(TEACHER_A_ID);
    });
  });

  it("a teacher cannot insert an expense with created_by set to someone else", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      await expect(
        insertExpense(client, {
          branchId: branchAId,
          createdBy: TEACHER_B_ID,
        }),
      ).rejects.toThrow();
    });
  });

  it("a teacher cannot insert an expense for another branch, whatever branch_id is sent", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      await expect(
        insertExpense(client, {
          branchId: branchBId,
          createdBy: TEACHER_A_ID,
        }),
      ).rejects.toThrow();
    });
  });

  it("a teacher cannot move an existing expense to another branch", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);
      const created = await insertExpense(client, {
        branchId: branchAId,
        createdBy: TEACHER_A_ID,
      });

      await expect(
        client.query("update expense set branch_id = $1 where id = $2", [
          branchBId,
          created.rows[0]!.id,
        ]),
      ).rejects.toThrow();
    });
  });

  it("a teacher may edit any expense in their own branch, including one a colleague entered", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);
      const created = await insertExpense(client, {
        branchId: branchAId,
        createdBy: TEACHER_A_ID,
      });

      await client.query("reset role");
      await impersonate(client, TEACHER_A2_ID);
      const result = await client.query(
        "update expense set amount_paise = 60000 where id = $1",
        [created.rows[0]!.id],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("a teacher's delete matches zero rows -- no grant, not just a false RLS policy", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);
      const created = await insertExpense(client, {
        branchId: branchAId,
        createdBy: TEACHER_A_ID,
      });

      const result = await client.query("delete from expense where id = $1", [
        created.rows[0]!.id,
      ]);
      expect(result.rowCount).toBe(0);
    });
  });

  it("admin can delete an expense", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonateAdmin(client);
      const created = await insertExpense(client, {
        branchId: branchAId,
        createdBy: ADMIN_ID,
      });

      const result = await client.query("delete from expense where id = $1", [
        created.rows[0]!.id,
      ]);
      expect(result.rowCount).toBe(1);
    });
  });

  it("a teacher's select on expense returns only their own branch's rows", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonateAdmin(client);
      await insertExpense(client, { branchId: branchAId, createdBy: ADMIN_ID });
      await insertExpense(client, { branchId: branchBId, createdBy: ADMIN_ID });

      await client.query("reset role");
      await impersonate(client, TEACHER_A_ID);
      const rows = await client.query<{ branch_id: string }>(
        "select branch_id from expense",
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0]!.branch_id).toBe(branchAId);
    });
  });

  it("a teacher's read access to payment/fee_account stays branch-scoped -- the expense RLS work doesn't loosen it", async () => {
    // Rule 6 already lets a teacher read their own branch's individual
    // payment/fee_account rows (only the dashboard aggregates are
    // admin-gated) -- this proves adding expense's teacher policies didn't
    // accidentally widen that to other branches.
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const ownBranch = await client.query<{ count: string }>(
        `select count(*) from payment p
         join fee_account fa on fa.id = p.fee_account_id
         join student s on s.id = fa.student_id
         where s.branch_id = $1`,
        [branchAId],
      );
      expect(Number(ownBranch.rows[0]!.count)).toBeGreaterThan(0);

      const otherBranch = await client.query<{ count: string }>(
        `select count(*) from payment p
         join fee_account fa on fa.id = p.fee_account_id
         join student s on s.id = fa.student_id
         where s.branch_id = $1`,
        [branchBId],
      );
      expect(Number(otherBranch.rows[0]!.count)).toBe(0);
    });
  });

  it("anon reads nothing from expense or expense_category", async () => {
    await withRollback(client, async () => {
      await client.query("set role anon");
      await expect(client.query("select * from expense")).rejects.toThrow();
      await expect(
        client.query("select * from expense_category"),
      ).rejects.toThrow();
    });
  });

  it("a category with expenses attached cannot be deleted", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonateAdmin(client);
      await insertExpense(client, { branchId: branchAId, createdBy: ADMIN_ID });

      await expect(
        client.query("delete from expense_category where id = $1", [
          categoryId,
        ]),
      ).rejects.toThrow();
    });
  });

  it("a category with expenses attached can still be deactivated", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonateAdmin(client);
      await insertExpense(client, { branchId: branchAId, createdBy: ADMIN_ID });

      const deactivated = await client.query(
        "update expense_category set is_active = false where id = $1",
        [categoryId],
      );
      expect(deactivated.rowCount).toBe(1);
    });
  });

  it("a teacher cannot write to expense_category", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      await expect(
        client.query(
          "insert into expense_category (name) values ('Teacher Added')",
        ),
      ).rejects.toThrow();
    });
  });

  it("a teacher's delete on expense_category matches zero rows, but an admin's succeeds", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonateAdmin(client);
      const created = await client.query<{ id: string }>(
        "insert into expense_category (name) values ('RLS Delete Test') returning id",
      );

      await client.query("reset role");
      await impersonate(client, TEACHER_A_ID);
      const teacherResult = await client.query(
        "delete from expense_category where id = $1",
        [created.rows[0]!.id],
      );
      expect(teacherResult.rowCount).toBe(0);

      await client.query("reset role");
      await impersonateAdmin(client);
      const adminResult = await client.query(
        "delete from expense_category where id = $1",
        [created.rows[0]!.id],
      );
      expect(adminResult.rowCount).toBe(1);
    });
  });
});
