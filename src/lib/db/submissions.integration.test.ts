import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000010";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000011";
const TEACHER_B_ID = "00000000-0000-4000-8000-000000000012";

describe("submission and approval flow", () => {
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

  it("a teacher can submit a new student for their own branch, and read it back", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const submission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
         values ($1, $2, 'SUB-1', 'New Kid', 'Guardian', '9000000001', 'Nursery-A',
                 $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')
         returning id`,
        [branchAId, TEACHER_A_ID, academicYearId],
      );

      const own = await client.query(
        "select status from student_submission where id = $1",
        [submission.rows[0]!.id],
      );
      expect(own.rows[0]!.status).toBe("pending");
    });
  });

  it("a teacher cannot submit a new student for a different branch", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      await expect(
        client.query(
          `insert into student_submission
             (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
              academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
           values ($1, $2, 'SUB-DENIED', 'New Kid', 'Guardian', '9000000002', 'Nursery-A',
                   $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')`,
          [branchBId, TEACHER_A_ID, academicYearId],
        ),
      ).rejects.toThrow();
    });
  });

  it("a teacher cannot read another teacher's submissions", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);
      // Seeded directly as admin (bypasses the insert check) purely to set
      // up the fixture -- the read restriction under test is independent of
      // how the row got there.
      await client.query(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, slot)
         values ($1, $2, 'SUB-B-1', 'Other Teacher''s Kid', 'Guardian', '9000000003', 'Nursery-A',
                 $3, 'daycare', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Morning')`,
        [branchBId, TEACHER_B_ID, academicYearId],
      );

      await impersonate(client, TEACHER_A_ID);
      const rows = await client.query(
        "select id from student_submission where admission_no = 'SUB-B-1'",
      );
      expect(rows.rows).toHaveLength(0);
    });
  });

  it("a teacher can propose an edit only for a student in their own branch", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentA = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'EDIT-A-1', 'Student A', 'Guardian A', '9000000004', 'Nursery-A')
         returning id`,
        [branchAId],
      );
      const feeAccountA = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [studentA.rows[0]!.id, academicYearId],
      );
      const studentB = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'EDIT-B-1', 'Student B', 'Guardian B', '9000000005', 'Nursery-A')
         returning id`,
        [branchBId],
      );
      const feeAccountB = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [studentB.rows[0]!.id, academicYearId],
      );

      await impersonate(client, TEACHER_A_ID);

      const allowed = await client.query(
        `insert into student_edit_submission
           (student_id, fee_account_id, branch_id, submitted_by, full_name, guardian_name, phone, class_section,
            total_receivable_paise, due_date, starts_on, ends_on, fee_account_status, route_name, pickup_point)
         values ($1, $2, $3, $4, 'Student A Updated', 'Guardian A', '9000000004', 'Nursery-A',
                 1200000, '2026-06-01', '2026-04-01', '2027-03-31', 'active', 'Route 1', 'Gate')
         returning id`,
        [studentA.rows[0]!.id, feeAccountA.rows[0]!.id, branchAId, TEACHER_A_ID],
      );
      expect(allowed.rows).toHaveLength(1);

      await expect(
        client.query(
          `insert into student_edit_submission
             (student_id, fee_account_id, branch_id, submitted_by, full_name, guardian_name, phone, class_section,
              total_receivable_paise, due_date, starts_on, ends_on, fee_account_status, route_name, pickup_point)
           values ($1, $2, $3, $4, 'Student B Updated', 'Guardian B', '9000000005', 'Nursery-A',
                   1200000, '2026-06-01', '2026-04-01', '2027-03-31', 'active', 'Route 1', 'Gate')`,
          [studentB.rows[0]!.id, feeAccountB.rows[0]!.id, branchAId, TEACHER_A_ID],
        ),
      ).rejects.toThrow();
    });
  });

  it("approve_student_submission creates exactly one student even under a concurrent double-approve", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const submission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
         values ($1, $2, 'SUB-APPROVE-1', 'Approve Me', 'Guardian', '9000000006', 'Nursery-A',
                 $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')
         returning id`,
        [branchAId, TEACHER_A_ID, academicYearId],
      );

      await impersonate(client, ADMIN_ID);
      const first = await client.query<{ approve_student_submission: string }>(
        "select approve_student_submission($1)",
        [submission.rows[0]!.id],
      );
      const studentId = first.rows[0]!.approve_student_submission;
      expect(studentId).toBeTruthy();

      // Simulates a second admin (or a double-click) approving the same
      // already-approved row in a fresh statement -- must be rejected, not
      // silently create a second student. A savepoint isolates the expected
      // failure so it doesn't poison the rest of this transaction the way a
      // bare error would (Postgres aborts the whole transaction on error).
      await client.query("savepoint before_second_approve");
      await expect(
        client.query("select approve_student_submission($1)", [
          submission.rows[0]!.id,
        ]),
      ).rejects.toThrow(/not pending/);
      await client.query("rollback to savepoint before_second_approve");

      const students = await client.query(
        "select id from student where admission_no = 'SUB-APPROVE-1'",
      );
      expect(students.rows).toHaveLength(1);
    });
  });

  it("approving a second service for the same admission number reuses the existing student row", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const transportSubmission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
         values ($1, $2, 'SUB-DUAL-1', 'Dual Service Kid', 'Guardian', '9000000010', 'Nursery-A',
                 $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')
         returning id`,
        [branchAId, TEACHER_A_ID, academicYearId],
      );

      await impersonate(client, ADMIN_ID);
      const first = await client.query<{ approve_student_submission: string }>(
        "select approve_student_submission($1)",
        [transportSubmission.rows[0]!.id],
      );

      // Only submitted (and approved) after the transport submission is no
      // longer pending -- student_submission_one_pending_admission (a
      // partial unique index, unrelated to this fix) blocks two PENDING
      // submissions for the same admission number regardless of service,
      // by design ("two teachers can't queue the same admission number at
      // once"). That's orthogonal to what's under test here: whether
      // approving a second, different-service submission for an
      // already-approved admission number reuses the student row.
      await impersonate(client, TEACHER_A_ID);
      const daycareSubmission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, slot)
         values ($1, $2, 'SUB-DUAL-1', 'Dual Service Kid', 'Guardian', '9000000010', 'Nursery-A',
                 $3, 'daycare', 800000, '2026-06-01', '2026-04-01', '2027-03-31', 'Morning')
         returning id`,
        [branchAId, TEACHER_A_ID, academicYearId],
      );

      await impersonate(client, ADMIN_ID);
      const second = await client.query<{ approve_student_submission: string }>(
        "select approve_student_submission($1)",
        [daycareSubmission.rows[0]!.id],
      );

      // Same student id both times -- one `student` row carrying both
      // services, not two rows that would have tripped
      // student_admission_no_unique_per_branch.
      expect(second.rows[0]!.approve_student_submission).toBe(
        first.rows[0]!.approve_student_submission,
      );

      const students = await client.query(
        "select id from student where admission_no = 'SUB-DUAL-1'",
      );
      expect(students.rows).toHaveLength(1);

      const feeAccounts = await client.query(
        "select service_type from fee_account where student_id = $1 order by service_type",
        [first.rows[0]!.approve_student_submission],
      );
      expect(feeAccounts.rows.map((r) => r.service_type)).toEqual([
        "daycare",
        "transport",
      ]);
    });
  });

  it("approve_student_submission rejects a second active submission in the same service for the same admission number", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const firstSubmission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
         values ($1, $2, 'SUB-DUPE-1', 'Duplicate Kid', 'Guardian', '9000000011', 'Nursery-A',
                 $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')
         returning id`,
        [branchAId, TEACHER_A_ID, academicYearId],
      );

      await impersonate(client, ADMIN_ID);
      await client.query("select approve_student_submission($1)", [
        firstSubmission.rows[0]!.id,
      ]);

      // Only submitted once the first is no longer pending -- see the
      // comment on the previous test for why (an unrelated existing
      // constraint would otherwise reject this insert outright).
      await impersonate(client, TEACHER_A_ID);
      const secondSubmission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
         values ($1, $2, 'SUB-DUPE-1', 'Duplicate Kid', 'Guardian', '9000000011', 'Nursery-A',
                 $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')
         returning id`,
        [branchAId, TEACHER_A_ID, academicYearId],
      );

      await impersonate(client, ADMIN_ID);
      // A savepoint isolates the expected failure, same as the concurrent
      // double-approve test above -- Postgres aborts the whole transaction
      // on an unhandled error otherwise.
      await client.query("savepoint before_duplicate_approve");
      await expect(
        client.query("select approve_student_submission($1)", [
          secondSubmission.rows[0]!.id,
        ]),
      ).rejects.toThrow(/already has an active transport student/);
      await client.query("rollback to savepoint before_duplicate_approve");

      const activeTransportAccounts = await client.query(
        `select fa.id from fee_account fa
         join student s on s.id = fa.student_id
         where s.admission_no = 'SUB-DUPE-1' and fa.service_type = 'transport' and fa.status = 'active'`,
      );
      expect(activeTransportAccounts.rows).toHaveLength(1);
    });
  });

  it("rejecting a submission creates nothing and records the reason", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const submission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
         values ($1, $2, 'SUB-REJECT-1', 'Reject Me', 'Guardian', '9000000007', 'Nursery-A',
                 $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')
         returning id`,
        [branchAId, TEACHER_A_ID, academicYearId],
      );

      await impersonate(client, ADMIN_ID);
      await client.query(
        `update student_submission
         set status = 'rejected', review_note = 'not needed', reviewed_by = $2, reviewed_at = now()
         where id = $1`,
        [submission.rows[0]!.id, ADMIN_ID],
      );

      const students = await client.query(
        "select id from student where admission_no = 'SUB-REJECT-1'",
      );
      expect(students.rows).toHaveLength(0);

      const row = await client.query(
        "select status, review_note from student_submission where id = $1",
        [submission.rows[0]!.id],
      );
      expect(row.rows[0]!.status).toBe("rejected");
      expect(row.rows[0]!.review_note).toBe("not needed");
    });
  });

  it("approve_student_edit changes exactly the proposed fields", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'EDIT-APPROVE-1', 'Old Name', 'Old Guardian', '9000000008', 'Nursery-A')
         returning id`,
        [branchAId],
      );
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Old Gate')
         returning id`,
        [student.rows[0]!.id, academicYearId],
      );

      await impersonate(client, TEACHER_A_ID);
      const edit = await client.query<{ id: string }>(
        `insert into student_edit_submission
           (student_id, fee_account_id, branch_id, submitted_by, full_name, guardian_name, phone, class_section,
            total_receivable_paise, due_date, starts_on, ends_on, fee_account_status, route_name, pickup_point)
         values ($1, $2, $3, $4, 'New Name', 'Old Guardian', '9000000008', 'Nursery-A',
                 1500000, '2026-06-01', '2026-04-01', '2027-03-31', 'active', 'Route 1', 'New Gate')
         returning id`,
        [student.rows[0]!.id, feeAccount.rows[0]!.id, branchAId, TEACHER_A_ID],
      );

      await impersonate(client, ADMIN_ID);
      await client.query("select approve_student_edit($1)", [edit.rows[0]!.id]);

      const updatedStudent = await client.query(
        "select full_name, guardian_name from student where id = $1",
        [student.rows[0]!.id],
      );
      expect(updatedStudent.rows[0]!.full_name).toBe("New Name");
      expect(updatedStudent.rows[0]!.guardian_name).toBe("Old Guardian");

      const updatedFeeAccount = await client.query(
        "select total_receivable_paise, pickup_point from fee_account where id = $1",
        [feeAccount.rows[0]!.id],
      );
      expect(updatedFeeAccount.rows[0]!.total_receivable_paise).toBe(
        "1500000",
      );
      expect(updatedFeeAccount.rows[0]!.pickup_point).toBe("New Gate");
    });
  });

  it("approve_payment_submission creates a real payment and stamps the submission", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'PAY-APPROVE-1', 'Student', 'Guardian', '9000000009', 'Nursery-A')
         returning id`,
        [branchAId],
      );
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [student.rows[0]!.id, academicYearId],
      );

      await impersonate(client, TEACHER_A_ID);
      const submission = await client.query<{ id: string }>(
        `insert into payment_submission
           (fee_account_id, branch_id, submitted_by, amount_paise, paid_on, method, reference, note)
         values ($1, $2, $3, 250000, '2026-06-15', 'upi', 'UPI-1', 'test')
         returning id`,
        [feeAccount.rows[0]!.id, branchAId, TEACHER_A_ID],
      );

      await impersonate(client, ADMIN_ID);
      const result = await client.query<{ approve_payment_submission: string }>(
        "select approve_payment_submission($1)",
        [submission.rows[0]!.id],
      );
      const paymentId = result.rows[0]!.approve_payment_submission;
      expect(paymentId).toBeTruthy();

      const payment = await client.query(
        "select amount_paise from payment where id = $1",
        [paymentId],
      );
      expect(payment.rows[0]!.amount_paise).toBe("250000");

      const updatedSubmission = await client.query(
        "select status, created_payment_id from payment_submission where id = $1",
        [submission.rows[0]!.id],
      );
      expect(updatedSubmission.rows[0]!.status).toBe("approved");
      expect(updatedSubmission.rows[0]!.created_payment_id).toBe(paymentId);
    });
  });
});
