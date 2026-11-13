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

  // One fixture for the filter tests: both ends of November, the day either
  // side of it, two categories, two methods, and text to search.
  async function seedFilterFixture(client: Client) {
    await seedFixtures(client);
    await impersonateAdmin(client);
    await client.query(
      `insert into expense
         (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, reference, note, created_by)
       values
         ($1, $2, $3, 1000, '2026-10-31', 'cash',  null,    'last day of October', $5),
         ($1, $2, $3, 2000, '2026-11-01', 'cash',  null,    'first of November',   $5),
         ($1, $2, $4, 4000, '2026-11-15', 'upi',   'UTR-77', 'DIESEL top-up',       $5),
         ($1, $2, $3, 8000, '2026-11-30', 'upi',   null,    null,                  $5),
         ($1, $2, $4, 16000, '2026-12-01', 'cash', null,    'first of December',   $5)`,
      [branchAId, academicYearId, groceryId, fuelId, ADMIN_ID],
    );
  }

  async function breakdown(
    client: Client,
    args: {
      category?: string;
      method?: string;
      from?: string;
      to?: string;
      q?: string;
    },
  ) {
    const result = await client.query<{
      category_name: string;
      amount_paise: string;
    }>(
      `select category_name, amount_paise from expense_category_breakdown(
         p_academic_year_id => $1, p_branch_code => 'BR-A',
         p_category_id => $2, p_method => $3, p_from => $4, p_to => $5, p_q => $6)`,
      [
        academicYearId,
        args.category ?? null,
        args.method ?? null,
        args.from ?? null,
        args.to ?? null,
        args.q ?? null,
      ],
    );
    return {
      rows: result.rows,
      total: result.rows.reduce((sum, r) => sum + Number(r.amount_paise), 0),
    };
  }

  it("a month's date range includes its first and last day and nothing either side", async () => {
    await withRollback(client, async () => {
      await seedFilterFixture(client);
      const november = await breakdown(client, {
        from: "2026-11-01",
        to: "2026-11-30",
      });
      // 2000 + 4000 + 8000; the 31 Oct and 1 Dec rows are outside.
      expect(november.total).toBe(14000);
    });
  });

  it("narrows by category, by method, and by both together", async () => {
    await withRollback(client, async () => {
      await seedFilterFixture(client);
      expect((await breakdown(client, { category: fuelId })).total).toBe(20000);
      expect((await breakdown(client, { method: "upi" })).total).toBe(12000);
      expect(
        (
          await breakdown(client, {
            category: groceryId,
            method: "upi",
            from: "2026-11-01",
            to: "2026-11-30",
          })
        ).total,
      ).toBe(8000);
    });
  });

  it("searches category name, reference and note without regard to case", async () => {
    await withRollback(client, async () => {
      await seedFilterFixture(client);
      expect((await breakdown(client, { q: "diesel" })).total).toBe(4000);
      expect((await breakdown(client, { q: "utr-77" })).total).toBe(4000);
      expect((await breakdown(client, { q: "first of" })).total).toBe(18000);
      // Matches the category name, so every Fuel row.
      expect((await breakdown(client, { q: "fuel" })).total).toBe(20000);
    });
  });

  it("gives the same total as the list's own query over the same filters", async () => {
    await withRollback(client, async () => {
      await seedFilterFixture(client);

      // The list reads expense_record with these predicates (see
      // expense-directory.ts's applyFilters); the card must agree with it.
      const cases = [
        {},
        { from: "2026-11-01", to: "2026-11-30" },
        { method: "upi" },
        { category: fuelId, from: "2026-11-01" },
        { q: "first" },
        { q: "DIESEL", method: "upi", to: "2026-11-30" },
      ];

      for (const filters of cases) {
        const fromList = await client.query<{ total: string | null }>(
          `select sum(amount_paise) as total from expense_record
           where academic_year_id = $1 and branch_code = 'BR-A'
             and ($2::uuid is null or category_id = $2)
             and ($3::text is null or method = $3)
             and ($4::date is null or spent_on >= $4)
             and ($5::date is null or spent_on <= $5)
             and ($6::text is null
                  or category_name ilike '%' || $6 || '%'
                  or reference ilike '%' || $6 || '%'
                  or note ilike '%' || $6 || '%')`,
          [
            academicYearId,
            filters.category ?? null,
            filters.method ?? null,
            filters.from ?? null,
            filters.to ?? null,
            filters.q ?? null,
          ],
        );
        const card = await breakdown(client, filters);
        expect(card.total, JSON.stringify(filters)).toBe(
          Number(fromList.rows[0]!.total ?? 0),
        );
      }
    });
  });
});
