import { faker } from "@faker-js/faker";
import { Client } from "pg";
import { CLASS_SECTIONS } from "../src/lib/records/class-sections";

// Deterministic: same seed every run, so integration tests can assert exact
// totals against this dataset.
faker.seed(42);

const DATABASE_URL =
  process.env.SEED_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:54322/postgres";

const FIRST_NAMES = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Vihaan",
  "Arjun",
  "Sai",
  "Reyansh",
  "Krishna",
  "Ishaan",
  "Rohan",
  "Ananya",
  "Diya",
  "Saanvi",
  "Aadhya",
  "Kiara",
  "Myra",
  "Anika",
  "Riya",
  "Ira",
  "Pari",
];
const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Gupta",
  "Iyer",
  "Nair",
  "Reddy",
  "Rao",
  "Patel",
  "Mehta",
  "Joshi",
  "Kapoor",
  "Chatterjee",
  "Menon",
  "Pillai",
  "Desai",
];
const ROUTES = [
  "Route 1 - MG Road",
  "Route 2 - Whitefield",
  "Route 3 - HSR Layout",
  "Route 4 - Indiranagar",
];
const PICKUP_POINTS = [
  "Main Gate",
  "Community Hall",
  "Bus Stop 4",
  "Society Gate",
];
const SLOTS = ["Morning (8-1)", "Full Day (8-6)", "Afternoon (1-6)"];
const METHODS = ["cash", "upi", "cheque", "bank_transfer"] as const;
const RECORDED_BY = ["front_office", "accounts_desk"];
const EXPENSE_CATEGORIES = [
  "Grocery",
  "Fuel",
  "Vehicle maintenance",
  "Driver salary",
  "Staff salary",
  "Stationery",
  "Utilities",
  "Repairs",
  "Cleaning supplies",
  "Miscellaneous",
];

type ServiceType = "transport" | "daycare";

type YearLabel = "2025-26" | "2026-27";

const YEAR_BOUNDS: Record<YearLabel, { startsOn: string; endsOn: string }> = {
  "2025-26": { startsOn: "2025-04-01", endsOn: "2026-03-31" },
  "2026-27": { startsOn: "2026-04-01", endsOn: "2027-03-31" },
};

// "Today" for seeding purposes is comfortably inside the 2026-27 year, so
// these due dates stay meaningfully overdue / not-yet-due for a long time.
const CURRENT_YEAR_OVERDUE_DUE_DATES = [
  "2026-05-15",
  "2026-06-20",
  "2026-07-10",
];
const CURRENT_YEAR_FUTURE_DUE_DATES = [
  "2026-11-15",
  "2026-12-20",
  "2027-01-10",
  "2027-02-05",
];
const PRIOR_YEAR_DUE_DATES = [
  "2025-06-15",
  "2025-09-01",
  "2025-11-20",
  "2026-01-10",
];

const ALL_SCENARIOS = [
  "fully_paid",
  "part_paid_not_overdue",
  "part_paid_overdue",
  "unpaid_not_overdue",
  "unpaid_overdue",
  "voided_then_unpaid",
  "overpaid",
] as const;

// A fully elapsed academic year can't have a "not yet due" account.
const ELAPSED_YEAR_SCENARIOS = ALL_SCENARIOS.filter(
  (scenario) => !scenario.includes("not_overdue"),
);

type Scenario = (typeof ALL_SCENARIOS)[number];

function randomIndianPhone(): string {
  const prefix = faker.helpers.arrayElement(["9", "8", "7"]);
  const rest = faker.string.numeric(9);
  return `${prefix}${rest}`;
}

function fullName(): string {
  return `${faker.helpers.arrayElement(FIRST_NAMES)} ${faker.helpers.arrayElement(LAST_NAMES)}`;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  await client.query("begin");
  try {
    await client.query(
      "truncate table payment, fee_account, student, academic_year, branch, expense_category restart identity cascade",
    );

    const branchRows = await client.query<{ id: string; code: string }>(
      `insert into branch (code, name, is_active) values
        ('BR-A', 'Kothanur', true),
        ('BR-B', 'Kannuru', true)
      returning id, code`,
    );
    const branchByCode = Object.fromEntries(
      branchRows.rows.map((r) => [r.code, r.id]),
    );

    const yearRows = await client.query<{ id: string; label: string }>(
      `insert into academic_year (label, starts_on, ends_on, is_current) values
        ('2025-26', '2025-04-01', '2026-03-31', false),
        ('2026-27', '2026-04-01', '2027-03-31', true)
      returning id, label`,
    );
    const yearByLabel = Object.fromEntries(
      yearRows.rows.map((r) => [r.label, r.id]),
    ) as Record<YearLabel, string>;

    for (const [index, name] of EXPENSE_CATEGORIES.entries()) {
      await client.query(
        `insert into expense_category (name, sort_order) values ($1, $2)`,
        [name, index],
      );
    }

    const STUDENT_COUNT = 60;
    const students: { id: string; index: number }[] = [];

    for (let i = 0; i < STUDENT_COUNT; i++) {
      const branchCode = i % 2 === 0 ? "BR-A" : "BR-B";
      const classSection = CLASS_SECTIONS[i % CLASS_SECTIONS.length];
      const result = await client.query<{ id: string }>(
        `insert into student
          (branch_id, admission_no, full_name, guardian_name, phone, class_section, status)
         values ($1, $2, $3, $4, $5, $6, 'active')
         returning id`,
        [
          branchByCode[branchCode],
          `${branchCode}-${String(i + 1).padStart(4, "0")}`,
          fullName(),
          fullName(),
          randomIndianPhone(),
          classSection,
        ],
      );
      students.push({ id: result.rows[0].id, index: i });
    }

    let scenarioCursor = 0;
    let feeAccountCount = 0;
    let paymentCount = 0;

    function nextScenario(pool: readonly Scenario[]): Scenario {
      const scenario = pool[scenarioCursor % pool.length];
      scenarioCursor += 1;
      return scenario;
    }

    async function createFeeAccount(
      studentId: string,
      yearLabel: YearLabel,
      serviceType: ServiceType,
    ) {
      const isElapsedYear = yearLabel === "2025-26";
      const scenario = nextScenario(
        isElapsedYear ? ELAPSED_YEAR_SCENARIOS : ALL_SCENARIOS,
      );

      const totalReceivablePaise =
        serviceType === "transport"
          ? faker.number.int({ min: 8, max: 15 }) * 100_000
          : faker.number.int({ min: 12, max: 20 }) * 100_000;

      const dueDate = isElapsedYear
        ? faker.helpers.arrayElement(PRIOR_YEAR_DUE_DATES)
        : scenario.includes("overdue")
          ? faker.helpers.arrayElement(CURRENT_YEAR_OVERDUE_DUE_DATES)
          : faker.helpers.arrayElement(CURRENT_YEAR_FUTURE_DUE_DATES);

      const { startsOn, endsOn } = YEAR_BOUNDS[yearLabel];

      const route =
        serviceType === "transport" ? faker.helpers.arrayElement(ROUTES) : null;
      const pickup =
        serviceType === "transport"
          ? faker.helpers.arrayElement(PICKUP_POINTS)
          : null;
      const slot =
        serviceType === "daycare" ? faker.helpers.arrayElement(SLOTS) : null;

      const feeAccountResult = await client.query<{ id: string }>(
        `insert into fee_account
          (student_id, academic_year_id, service_type, total_receivable_paise,
           due_date, starts_on, ends_on, status, route_name, pickup_point, slot)
         values ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)
         returning id`,
        [
          studentId,
          yearByLabel[yearLabel],
          serviceType,
          totalReceivablePaise,
          dueDate,
          startsOn,
          endsOn,
          route,
          pickup,
          slot,
        ],
      );
      const feeAccountId = feeAccountResult.rows[0].id;
      feeAccountCount += 1;

      const recordedBy = faker.helpers.arrayElement(RECORDED_BY);
      const method = faker.helpers.arrayElement(METHODS);
      const paidOn = dueDate;

      async function recordPayment(
        amountPaise: number,
        options?: { voided?: boolean },
      ) {
        if (options?.voided) {
          await client.query(
            `insert into payment
              (fee_account_id, amount_paise, paid_on, method, recorded_by, voided_at, void_reason)
             values ($1, $2, $3, $4, $5, now(), 'Recorded against the wrong fee account')`,
            [feeAccountId, amountPaise, paidOn, method, recordedBy],
          );
        } else {
          await client.query(
            `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
             values ($1, $2, $3, $4, $5)`,
            [feeAccountId, amountPaise, paidOn, method, recordedBy],
          );
        }
        paymentCount += 1;
      }

      switch (scenario) {
        case "fully_paid":
          await recordPayment(totalReceivablePaise);
          break;
        case "part_paid_not_overdue":
        case "part_paid_overdue":
          await recordPayment(Math.round(totalReceivablePaise * 0.6));
          break;
        case "unpaid_not_overdue":
        case "unpaid_overdue":
          break;
        case "voided_then_unpaid":
          await recordPayment(totalReceivablePaise, { voided: true });
          break;
        case "overpaid":
          await recordPayment(Math.round(totalReceivablePaise * 1.2));
          break;
      }
    }

    for (const student of students) {
      const primaryService: ServiceType =
        student.index % 5 === 4 ? "daycare" : "transport";
      await createFeeAccount(student.id, "2026-27", primaryService);

      // ~1 in 3 students use both services at once.
      if (student.index % 3 === 0) {
        const otherService: ServiceType =
          primaryService === "transport" ? "daycare" : "transport";
        await createFeeAccount(student.id, "2026-27", otherService);
      }

      // ~1 in 4 students are continuing from the prior year.
      if (student.index % 4 === 0) {
        await createFeeAccount(student.id, "2025-26", primaryService);
      }
    }

    await client.query("commit");
    console.log(
      `Seeded ${students.length} students, ${feeAccountCount} fee accounts, ${paymentCount} payments.`,
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
