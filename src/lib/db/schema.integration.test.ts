import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, withRollback } from "./test-helpers";

describe("schema", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("migrated all five domain tables plus the balance view", async () => {
    const result = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
       and table_name in
         ('branch', 'academic_year', 'student', 'fee_account', 'payment', 'fee_account_balance')`,
    );
    const names = result.rows.map((r) => r.table_name).sort();
    expect(names).toEqual(
      [
        "academic_year",
        "branch",
        "fee_account",
        "fee_account_balance",
        "payment",
        "student",
      ].sort(),
    );
  });

  async function insertFixtureStudent(fixtureClient: Client) {
    const branch = await fixtureClient.query<{ id: string }>(
      `insert into branch (code, name) values ('FX', 'Fixture Branch') returning id`,
    );
    const year = await fixtureClient.query<{ id: string }>(
      `insert into academic_year (label, starts_on, ends_on, is_current)
       values ('fixture-year', '2026-04-01', '2027-03-31', false) returning id`,
    );
    const student = await fixtureClient.query<{ id: string }>(
      `insert into student
         (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, 'FX-0001', 'Fixture Student', 'Fixture Guardian', '9000000000', 'Nursery-A')
       returning id`,
      [branch.rows[0].id],
    );
    return { studentId: student.rows[0].id, yearId: year.rows[0].id };
  }

  it("rejects a transport fee account carrying a daycare-only slot", async () => {
    await withRollback(client, async () => {
      const { studentId, yearId } = await insertFixtureStudent(client);
      await expect(
        client.query(
          `insert into fee_account
             (student_id, academic_year_id, service_type, total_receivable_paise,
              due_date, starts_on, ends_on, slot)
           values ($1, $2, 'transport', 100000, '2026-06-01', '2026-04-01', '2027-03-31', 'Morning')`,
          [studentId, yearId],
        ),
      ).rejects.toThrow();
    });
  });

  it("rejects a daycare fee account carrying transport-only route/pickup columns", async () => {
    await withRollback(client, async () => {
      const { studentId, yearId } = await insertFixtureStudent(client);
      await expect(
        client.query(
          `insert into fee_account
             (student_id, academic_year_id, service_type, total_receivable_paise,
              due_date, starts_on, ends_on, route_name)
           values ($1, $2, 'daycare', 100000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1')`,
          [studentId, yearId],
        ),
      ).rejects.toThrow();
    });
  });

  it("accepts a valid transport account and a valid daycare account", async () => {
    await withRollback(client, async () => {
      const { studentId, yearId } = await insertFixtureStudent(client);

      await expect(
        client.query(
          `insert into fee_account
             (student_id, academic_year_id, service_type, total_receivable_paise,
              due_date, starts_on, ends_on, route_name, pickup_point)
           values ($1, $2, 'transport', 100000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Main Gate')`,
          [studentId, yearId],
        ),
      ).resolves.toBeDefined();

      await expect(
        client.query(
          `insert into fee_account
             (student_id, academic_year_id, service_type, total_receivable_paise,
              due_date, starts_on, ends_on, slot)
           values ($1, $2, 'daycare', 100000, '2026-06-01', '2026-04-01', '2027-03-31', 'Morning')`,
          [studentId, yearId],
        ),
      ).resolves.toBeDefined();
    });
  });
});
