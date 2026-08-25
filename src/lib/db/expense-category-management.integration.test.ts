import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, impersonateAdmin, withRollback } from "./test-helpers";

describe("expense category management (phase 10.2)", () => {
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

  it("a new category lands after the current highest sort_order", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const { rows: maxRows } = await client.query<{ max: number | null }>(
        "select max(sort_order) as max from expense_category",
      );
      const nextSortOrder = (maxRows[0]!.max ?? -1) + 1;

      const created = await client.query<{ sort_order: number }>(
        "insert into expense_category (name, sort_order) values ('Test Category', $1) returning sort_order",
        [nextSortOrder],
      );
      expect(created.rows[0]!.sort_order).toBe(nextSortOrder);
    });
  });

  it("a case-insensitive duplicate name is rejected by the unique index", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      await client.query(
        "insert into expense_category (name) values ('Groceries Test')",
      );

      await expect(
        client.query(
          "insert into expense_category (name) values ('groceries test')",
        ),
      ).rejects.toThrow();
    });
  });

  it("reordering swaps exactly two rows' sort_order and nothing else", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const first = await client.query<{ id: string }>(
        "insert into expense_category (name, sort_order) values ('Reorder A', 100) returning id",
      );
      const second = await client.query<{ id: string }>(
        "insert into expense_category (name, sort_order) values ('Reorder B', 101) returning id",
      );

      await client.query(
        "update expense_category set sort_order = 101 where id = $1",
        [first.rows[0]!.id],
      );
      await client.query(
        "update expense_category set sort_order = 100 where id = $1",
        [second.rows[0]!.id],
      );

      const swapped = await client.query<{ id: string; sort_order: number }>(
        "select id, sort_order from expense_category where id in ($1, $2)",
        [first.rows[0]!.id, second.rows[0]!.id],
      );
      const byId = new Map(swapped.rows.map((r) => [r.id, r.sort_order]));
      expect(byId.get(first.rows[0]!.id)).toBe(101);
      expect(byId.get(second.rows[0]!.id)).toBe(100);
    });
  });

  it("deleting a category with zero expenses succeeds", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const created = await client.query<{ id: string }>(
        "insert into expense_category (name) values ('Delete Me Test') returning id",
      );

      const result = await client.query(
        "delete from expense_category where id = $1",
        [created.rows[0]!.id],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("deleting a category with expenses attached fails with a foreign key violation", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const branch = await client.query<{ id: string }>(
        "select id from branch where code = 'BR-A' limit 1",
      );
      const year = await client.query<{ id: string }>(
        "select id from academic_year where is_current = true limit 1",
      );
      const category = await client.query<{ id: string }>(
        "insert into expense_category (name) values ('In Use Test') returning id",
      );
      await client.query(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values ($1, $2, $3, 50000, '2026-06-01', 'cash',
           (select id from profile where role = 'admin' limit 1))`,
        [branch.rows[0]!.id, year.rows[0]!.id, category.rows[0]!.id],
      );

      let errorCode: string | undefined;
      try {
        await client.query("delete from expense_category where id = $1", [
          category.rows[0]!.id,
        ]);
      } catch (error) {
        errorCode = (error as { code?: string }).code;
      }
      expect(errorCode).toBe("23503");
    });
  });

  it("expense_category_summary reflects expense count and total spent for a category", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const branch = await client.query<{ id: string }>(
        "select id from branch where code = 'BR-A' limit 1",
      );
      const year = await client.query<{ id: string }>(
        "select id from academic_year where is_current = true limit 1",
      );
      const category = await client.query<{ id: string }>(
        "insert into expense_category (name) values ('Summary Test') returning id",
      );
      const adminId = await client.query<{ id: string }>(
        "select id from profile where role = 'admin' limit 1",
      );
      await client.query(
        `insert into expense
           (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values
           ($1, $2, $3, 30000, '2026-06-01', 'cash', $4),
           ($1, $2, $3, 20000, '2026-06-02', 'cash', $4)`,
        [branch.rows[0]!.id, year.rows[0]!.id, category.rows[0]!.id, adminId.rows[0]!.id],
      );

      const summary = await client.query<{
        expense_count: number;
        total_spent_paise: string;
      }>(
        "select expense_count, total_spent_paise from expense_category_summary where id = $1",
        [category.rows[0]!.id],
      );
      expect(Number(summary.rows[0]!.expense_count)).toBe(2);
      expect(Number(summary.rows[0]!.total_spent_paise)).toBe(50000);
    });
  });
});
