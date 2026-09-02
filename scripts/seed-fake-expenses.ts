import { faker } from "@faker-js/faker";
import { Client } from "pg";

// One-off/demo seeding, separate from seed.ts on purpose: seed.ts's own
// truncate already resets `expense` to empty every run (it inserts
// `expense_category` rows but never actual `expense` rows), and expense
// isn't append-only the way `payment` is (see CLAUDE.md rule 8) -- there's
// no correctness reason this has to live in the same transaction as the
// student/fee-account data. Run after `npm run db:seed` and
// `npm run auth:seed` (needs an admin profile to attribute rows to).
faker.seed(42);

const DATABASE_URL =
  process.env.SEED_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:54322/postgres";

const METHODS = ["cash", "upi", "cheque", "bank_transfer"] as const;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  await client.query("begin");
  try {
    const { rows: branches } = await client.query<{ id: string; code: string }>(
      "select id, code from branch",
    );
    if (branches.length === 0) {
      throw new Error("No branches found -- run `npm run db:seed` first.");
    }

    const { rows: years } = await client.query<{ id: string; label: string }>(
      "select id, label from academic_year where is_current = true",
    );
    const currentYear = years[0];
    if (!currentYear) {
      throw new Error("No current academic year -- run `npm run db:seed` first.");
    }

    const { rows: categories } = await client.query<{
      id: string;
      name: string;
    }>("select id, name from expense_category order by sort_order");
    if (categories.length === 0) {
      throw new Error(
        "No expense categories found -- run `npm run db:seed` first.",
      );
    }

    const { rows: admins } = await client.query<{ id: string }>(
      "select id from profile where role = 'admin' limit 1",
    );
    const admin = admins[0];
    if (!admin) {
      throw new Error(
        "No admin profile found -- run `npm run auth:seed` first.",
      );
    }

    // Clears only this academic year's rows, so re-running is idempotent
    // without touching a different year's data if one ever exists.
    await client.query("delete from expense where academic_year_id = $1", [
      currentYear.id,
    ]);

    // Rough per-category amount bands (in paise) so "Fuel"/"Staff salary"
    // don't look interchangeable with "Stationery" on the breakdown chart
    // -- a flat random range across all categories would read as fake in
    // a different, more obvious way than the numbers themselves being made up.
    const AMOUNT_BAND_PAISE: Record<string, [number, number]> = {
      Grocery: [80_000, 4_00_000],
      Fuel: [1_50_000, 6_00_000],
      "Vehicle maintenance": [2_00_000, 15_00_000],
      "Driver salary": [15_00_000, 22_00_000],
      "Staff salary": [18_00_000, 30_00_000],
      Stationery: [20_000, 1_50_000],
      Utilities: [3_00_000, 9_00_000],
      Repairs: [1_00_000, 8_00_000],
      "Cleaning supplies": [30_000, 1_20_000],
      Miscellaneous: [10_000, 2_50_000],
    };

    const RECORDS_PER_BRANCH_PER_MONTH = 3;
    const yearStart = new Date(2026, 3, 1); // matches seed.ts's 2026-27 starts_on
    const monthsSoFar = 6; // Apr–Sep, so the chart has real spread, not one month

    let inserted = 0;
    for (const branch of branches) {
      for (let m = 0; m < monthsSoFar; m++) {
        const monthDate = new Date(yearStart);
        monthDate.setMonth(monthDate.getMonth() + m);

        for (let i = 0; i < RECORDS_PER_BRANCH_PER_MONTH; i++) {
          const category = faker.helpers.arrayElement(categories);
          const [min, max] = AMOUNT_BAND_PAISE[category.name] ?? [
            50_000, 2_00_000,
          ];
          const amountPaise = faker.number.int({ min, max });
          const spentOn = faker.date.between({
            from: monthDate,
            to: new Date(
              monthDate.getFullYear(),
              monthDate.getMonth() + 1,
              0,
            ),
          });
          const method = faker.helpers.arrayElement(METHODS);

          await client.query(
            `insert into expense
              (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, reference, note, created_by)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              branch.id,
              currentYear.id,
              category.id,
              amountPaise,
              spentOn.toISOString().slice(0, 10),
              method,
              method === "cheque" ? `CHQ-${faker.number.int({ min: 1000, max: 9999 })}` : null,
              null,
              admin.id,
            ],
          );
          inserted++;
        }
      }
    }

    await client.query("commit");
    console.log(
      `Seeded ${inserted} fake expense rows across ${branches.length} branches, ${monthsSoFar} months, ${currentYear.label}.`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
