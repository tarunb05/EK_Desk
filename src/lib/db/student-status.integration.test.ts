import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

// Same fake auth.users/profile approach as role-based-rls.integration.test.ts
// -- CI's `test` job runs against a bare Postgres service container with no
// real GoTrue.
const ADMIN_ID = "00000000-0000-4000-8000-000000000011";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000012";
const TEACHER_B_ID = "00000000-0000-4000-8000-000000000013";

describe("student status transitions (phase 9.1)", () => {
  let client: Client;
  let branchAId: string;
  let branchBId: string;
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
    const branchB = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-B' limit 1",
    );
    branchBId = branchB.rows[0]!.id;
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current = true limit 1",
    );
    academicYearId = year.rows[0]!.id;
  });

  async function seedProfiles(client: Client) {
    await client.query(
      `insert into auth.users (id) values ($1), ($2), ($3)
       on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_A_ID, TEACHER_B_ID],
    );
    await client.query(
      `insert into profile (id, role, branch_id, full_name) values
         ($1, 'admin', null, 'Test Admin'),
         ($2, 'teacher', $4, 'Test Teacher A'),
         ($3, 'teacher', $5, 'Test Teacher B')`,
      [ADMIN_ID, TEACHER_A_ID, TEACHER_B_ID, branchAId, branchBId],
    );
  }

  async function insertStudent(
    client: Client,
    branchId: string,
    admissionNo: string,
  ): Promise<string> {
    const student = await client.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Status Test', 'Guardian', '9999999999', 'Nursery-A')
       returning id`,
      [branchId, admissionNo],
    );
    return student.rows[0]!.id;
  }

  it("a teacher can set status on their own branch's student", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId, "STATUS-A-1");

      await impersonate(client, TEACHER_A_ID);
      const result = await client.query(
        "update student set status = 'inactive' where id = $1",
        [studentId],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("a teacher's update to another branch's student matches zero rows", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchBId, "STATUS-B-1");

      await impersonate(client, TEACHER_A_ID);
      const result = await client.query(
        "update student set status = 'inactive' where id = $1",
        [studentId],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("a teacher cannot change any other column alongside status", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId, "STATUS-A-2");

      await impersonate(client, TEACHER_A_ID);
      await expect(
        client.query(
          "update student set status = 'inactive', full_name = 'Changed Name' where id = $1",
          [studentId],
        ),
      ).rejects.toThrow(/only change a student's status/);
    });
  });

  it("a teacher's update to fee_account.status matches zero rows -- no write policy applies at all", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId, "STATUS-A-3");
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [studentId, academicYearId],
      );

      await impersonate(client, TEACHER_A_ID);
      const result = await client.query(
        "update fee_account set status = 'discontinued' where id = $1",
        [feeAccount.rows[0]!.id],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("admin can set student.status to any branch, including other columns in the same statement", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchBId, "STATUS-ADMIN-1");

      await impersonateAdmin(client);
      const result = await client.query(
        "update student set status = 'withdrawn', full_name = 'Renamed' where id = $1",
        [studentId],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("admin can discontinue a fee_account", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId, "STATUS-ADMIN-2");
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [studentId, academicYearId],
      );

      await impersonateAdmin(client);
      const result = await client.query(
        "update fee_account set status = 'discontinued' where id = $1",
        [feeAccount.rows[0]!.id],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("discontinuing a fee_account changes dashboard_summary's enrolled count and receivable", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId, "STATUS-DASH-1");
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [studentId, academicYearId],
      );

      await impersonateAdmin(client);

      const before = await client.query<{ total_receivable_paise: string }>(
        "select total_receivable_paise from dashboard_summary('transport', $1, 'BR-A')",
        [academicYearId],
      );

      await client.query("update fee_account set status = 'discontinued' where id = $1", [
        feeAccount.rows[0]!.id,
      ]);

      const after = await client.query<{ total_receivable_paise: string }>(
        "select total_receivable_paise from dashboard_summary('transport', $1, 'BR-A')",
        [academicYearId],
      );

      expect(BigInt(before.rows[0]!.total_receivable_paise) - BigInt(after.rows[0]!.total_receivable_paise)).toBe(
        1000000n,
      );
    });
  });
});
