import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000031";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000032";
const TEACHER_B_ID = "00000000-0000-4000-8000-000000000033";

describe("student delete submission (teacher-requested, admin-approved)", () => {
  let client: Client;
  let branchAId: string;
  let branchBId: string;

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

  let admissionCounter = 0;
  async function insertStudent(client: Client, branchId: string): Promise<string> {
    admissionCounter += 1;
    const student = await client.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Delete Request Test', 'Guardian', '9999999999', 'Nursery-A')
       returning id`,
      [branchId, `DEL-SUB-${admissionCounter}`],
    );
    return student.rows[0]!.id;
  }

  it("a teacher can submit a delete request for their own branch's student", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId);

      await impersonate(client, TEACHER_A_ID);
      const result = await client.query(
        `insert into student_delete_submission
           (student_id, branch_id, submitted_by, student_full_name, student_admission_no)
         values ($1, $2, $3, 'Delete Request Test', 'DEL-SUB-X')`,
        [studentId, branchAId, TEACHER_A_ID],
      );
      expect(result.rowCount).toBe(1);
    });
  });

  it("a teacher cannot submit a delete request for another branch's student", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchBId);

      await impersonate(client, TEACHER_A_ID);
      await expect(
        client.query(
          `insert into student_delete_submission
             (student_id, branch_id, submitted_by, student_full_name, student_admission_no)
           values ($1, $2, $3, 'Delete Request Test', 'DEL-SUB-X')`,
          [studentId, branchBId, TEACHER_A_ID],
        ),
      ).rejects.toThrow();
    });
  });

  it("teacher B cannot see teacher A's delete submission", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId);

      await impersonate(client, TEACHER_A_ID);
      await client.query(
        `insert into student_delete_submission
           (student_id, branch_id, submitted_by, student_full_name, student_admission_no)
         values ($1, $2, $3, 'Delete Request Test', 'DEL-SUB-X')`,
        [studentId, branchAId, TEACHER_A_ID],
      );

      await client.query("reset role");
      await impersonate(client, TEACHER_B_ID);
      const rows = await client.query(
        "select id from student_delete_submission",
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("approve_student_delete deletes the student and marks the submission approved", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId);

      await impersonate(client, TEACHER_A_ID);
      const submission = await client.query<{ id: string }>(
        `insert into student_delete_submission
           (student_id, branch_id, submitted_by, student_full_name, student_admission_no)
         values ($1, $2, $3, 'Delete Request Test', 'DEL-SUB-X')
         returning id`,
        [studentId, branchAId, TEACHER_A_ID],
      );

      await client.query("reset role");
      await impersonateAdmin(client);
      await client.query("select approve_student_delete($1)", [
        submission.rows[0]!.id,
      ]);

      const student = await client.query("select 1 from student where id = $1", [
        studentId,
      ]);
      expect(student.rowCount).toBe(0);

      const reviewed = await client.query<{
        status: string;
        student_id: string | null;
      }>(
        "select status, student_id from student_delete_submission where id = $1",
        [submission.rows[0]!.id],
      );
      expect(reviewed.rows[0]!.status).toBe("approved");
      expect(reviewed.rows[0]!.student_id).toBeNull();
    });
  });

  it("a teacher cannot call approve_student_delete", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId);

      await impersonate(client, TEACHER_A_ID);
      const submission = await client.query<{ id: string }>(
        `insert into student_delete_submission
           (student_id, branch_id, submitted_by, student_full_name, student_admission_no)
         values ($1, $2, $3, 'Delete Request Test', 'DEL-SUB-X')
         returning id`,
        [studentId, branchAId, TEACHER_A_ID],
      );

      await expect(
        client.query("select approve_student_delete($1)", [
          submission.rows[0]!.id,
        ]),
      ).rejects.toThrow(/only an admin/);
    });
  });

  it("rejecting a delete submission does not touch the student", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentId = await insertStudent(client, branchAId);

      await impersonate(client, TEACHER_A_ID);
      const submission = await client.query<{ id: string }>(
        `insert into student_delete_submission
           (student_id, branch_id, submitted_by, student_full_name, student_admission_no)
         values ($1, $2, $3, 'Delete Request Test', 'DEL-SUB-X')
         returning id`,
        [studentId, branchAId, TEACHER_A_ID],
      );

      await client.query("reset role");
      await impersonateAdmin(client);
      await client.query(
        `update student_delete_submission
         set status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = 'not needed'
         where id = $1`,
        [submission.rows[0]!.id, ADMIN_ID],
      );

      const student = await client.query("select 1 from student where id = $1", [
        studentId,
      ]);
      expect(student.rowCount).toBe(1);
    });
  });
});
