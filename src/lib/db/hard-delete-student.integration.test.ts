import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000021";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000022";

describe("hard delete a student (phase 9)", () => {
  let client: Client;
  let branchAId: string;
  let academicYearId: string;

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
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current = true limit 1",
    );
    academicYearId = year.rows[0]!.id;
  });

  async function seedProfiles(client: Client) {
    await client.query(
      `insert into auth.users (id) values ($1), ($2) on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_A_ID],
    );
    await client.query(
      `insert into profile (id, role, branch_id, full_name) values
         ($1, 'admin', null, 'Test Admin'),
         ($2, 'teacher', $3, 'Test Teacher A')`,
      [ADMIN_ID, TEACHER_A_ID, branchAId],
    );
  }

  let admissionCounter = 0;

  async function seedStudentWithFeeAccountAndPayment(client: Client) {
    admissionCounter += 1;
    const student = await client.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Delete Me', 'Guardian', '9998887777', 'Nursery-A')
       returning id`,
      [branchAId, `HARD-DEL-${admissionCounter}`],
    );
    const feeAccount = await client.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
       values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
       returning id`,
      [student.rows[0]!.id, academicYearId],
    );
    await client.query(
      `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
       values ($1, 50000, '2026-06-01', 'cash', 'admin')`,
      [feeAccount.rows[0]!.id],
    );
    return { studentId: student.rows[0]!.id, feeAccountId: feeAccount.rows[0]!.id };
  }

  it("a teacher's delete matches zero rows -- no grant, not just a false RLS policy", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { studentId } = await seedStudentWithFeeAccountAndPayment(client);

      await impersonate(client, TEACHER_A_ID);
      const result = await client.query("delete from student where id = $1", [
        studentId,
      ]);
      expect(result.rowCount).toBe(0);
    });
  });

  it("admin deleting a student cascades to exactly its own fee accounts and payments", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { studentId, feeAccountId } =
        await seedStudentWithFeeAccountAndPayment(client);

      await impersonateAdmin(client);
      const result = await client.query("delete from student where id = $1", [
        studentId,
      ]);
      expect(result.rowCount).toBe(1);

      const feeAccounts = await client.query(
        "select 1 from fee_account where id = $1",
        [feeAccountId],
      );
      expect(feeAccounts.rowCount).toBe(0);

      const payments = await client.query(
        "select 1 from payment where fee_account_id = $1",
        [feeAccountId],
      );
      expect(payments.rowCount).toBe(0);
    });
  });

  it("deleting a non-existent student id is a clean no-op", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonateAdmin(client);

      const result = await client.query(
        "delete from student where id = '00000000-0000-4000-8000-999999999999'",
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("deleting a student does not touch another student's fee accounts", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const first = await seedStudentWithFeeAccountAndPayment(client);
      const second = await seedStudentWithFeeAccountAndPayment(client);

      await impersonateAdmin(client);
      await client.query("delete from student where id = $1", [
        first.studentId,
      ]);

      const survivor = await client.query(
        "select 1 from fee_account where id = $1",
        [second.feeAccountId],
      );
      expect(survivor.rowCount).toBe(1);
    });
  });
});
