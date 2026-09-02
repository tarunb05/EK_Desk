import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, withRollback } from "./test-helpers";

// Phase 12.1: the activity_log capture layer -- no page yet, so every test
// here talks to the table and the trigger directly rather than through a
// Server Action.
const ADMIN_ID = "00000000-0000-4000-8000-000000000050";
const TEACHER_ID = "00000000-0000-4000-8000-000000000051";

describe("activity log (phase 12.1 -- capture, RLS)", () => {
  let client: Client;
  let branchId: string;
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
    const branch = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-A' limit 1",
    );
    branchId = branch.rows[0]!.id;
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
      `insert into auth.users (id) values ($1), ($2)
       on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_ID],
    );
    await client.query(
      `insert into profile (id, role, branch_id, full_name) values
         ($1, 'admin', null, 'Test Admin'),
         ($2, 'teacher', $3, 'Test Teacher')`,
      [ADMIN_ID, TEACHER_ID, branchId],
    );
  }

  async function insertStudent(client: Client, fullName = "Log Test Student") {
    const result = await client.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, $3, 'Guardian', '9000000100', 'Nursery-A')
       returning id`,
      [branchId, `LOG-${Date.now()}-${Math.random()}`, fullName],
    );
    return result.rows[0]!.id;
  }

  async function insertFeeAccount(
    client: Client,
    studentId: string,
    serviceType: "transport" | "daycare" = "transport",
  ) {
    const result = await client.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
       values ($1, $2, $3, 1000000, '2026-06-01', '2026-04-01', '2027-03-31', $4)
       returning id`,
      [
        studentId,
        academicYearId,
        serviceType,
        serviceType === "transport" ? "Gate" : null,
      ],
    );
    return result.rows[0]!.id;
  }

  it("inserting a student writes exactly one row with the right actor, entity and label", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const studentId = await insertStudent(client, "Aarav Sharma");

      const rows = await client.query(
        "select actor_id, actor_label, action, entity, entity_label from activity_log where entity = 'student' and entity_id = $1",
        [studentId],
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]).toMatchObject({
        actor_id: ADMIN_ID,
        actor_label: "Test Admin",
        action: "create",
        entity: "student",
        entity_label: "Aarav Sharma",
      });
    });
  });

  it("updating a student writes one row whose changed_fields is exactly the columns that changed, excluding updated_at", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const studentId = await insertStudent(client);
      await client.query(
        "update student set full_name = 'Renamed Student', updated_at = now() where id = $1",
        [studentId],
      );

      const rows = await client.query<{ changed_fields: string[] }>(
        "select changed_fields from activity_log where entity_id = $1 and action = 'update'",
        [studentId],
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]!.changed_fields).toEqual(["full_name"]);
    });
  });

  it("an update that changes nothing writes no row", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const studentId = await insertStudent(client);
      // Same value back, plus the updated_at bump every real save does --
      // this is exactly the "form resubmitted unchanged" case the no-op
      // guard exists for.
      await client.query(
        "update student set full_name = full_name, updated_at = now() where id = $1",
        [studentId],
      );

      const rows = await client.query(
        "select id from activity_log where entity_id = $1",
        [studentId],
      );
      // Only the original create row -- the no-op update wrote nothing.
      expect(rows.rows).toHaveLength(1);
    });
  });

  it("deleting a student writes rows for the student, its fee accounts and its payments, all sharing one txid and the acting admin's id", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const studentId = await insertStudent(client, "Cascade Test Student");
      const transportId = await insertFeeAccount(client, studentId, "transport");
      const daycareId = await insertFeeAccount(client, studentId, "daycare");
      const payment = await client.query<{ id: string }>(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 500000, '2026-06-15', 'upi', 'Test Admin')
         returning id`,
        [transportId],
      );
      const paymentId = payment.rows[0]!.id;

      await client.query("delete from student where id = $1", [studentId]);

      const rows = await client.query<{
        entity: string;
        entity_id: string;
        txid: string;
        actor_id: string | null;
      }>(
        `select entity, entity_id, txid, actor_id from activity_log
         where action = 'delete'
           and entity_id in ($1, $2, $3, $4)`,
        [studentId, transportId, daycareId, paymentId],
      );

      expect(rows.rows).toHaveLength(4);
      const txids = new Set(rows.rows.map((r) => r.txid));
      expect(txids.size).toBe(1);
      for (const row of rows.rows) {
        expect(row.actor_id).toBe(ADMIN_ID);
      }
    });
  });

  it("recording a payment writes a row, and voiding it writes a second row carrying the reason", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const studentId = await insertStudent(client, "Payment Test Student");
      const feeAccountId = await insertFeeAccount(client, studentId);
      const payment = await client.query<{ id: string }>(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 250000, '2026-06-15', 'upi', 'Test Admin')
         returning id`,
        [feeAccountId],
      );
      const paymentId = payment.rows[0]!.id;

      const created = await client.query(
        "select action, after_amount_paise from activity_log where entity = 'payment' and entity_id = $1",
        [paymentId],
      );
      expect(created.rows).toHaveLength(1);
      expect(created.rows[0]).toMatchObject({
        action: "create",
        after_amount_paise: "250000",
      });

      await client.query(
        "update payment set voided_at = now(), void_reason = 'wrong amount entered' where id = $1",
        [paymentId],
      );

      const voided = await client.query<{ summary: string }>(
        "select summary from activity_log where entity = 'payment' and entity_id = $1 and action = 'update'",
        [paymentId],
      );
      expect(voided.rows).toHaveLength(1);
      expect(voided.rows[0]!.summary).toContain("wrong amount entered");
    });
  });

  it("an expense edit and an expense delete each write one row", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const expense = await client.query<{ id: string }>(
        `insert into expense (branch_id, academic_year_id, category_id, amount_paise, spent_on, method, created_by)
         values ($1, $2, $3, 50000, '2026-06-01', 'cash', $4)
         returning id`,
        [branchId, academicYearId, categoryId, ADMIN_ID],
      );
      const expenseId = expense.rows[0]!.id;

      await client.query(
        "update expense set amount_paise = 75000, updated_by = $2, updated_at = now() where id = $1",
        [expenseId, ADMIN_ID],
      );
      const updated = await client.query(
        "select before_amount_paise, after_amount_paise from activity_log where entity_id = $1 and action = 'update'",
        [expenseId],
      );
      expect(updated.rows).toHaveLength(1);
      expect(updated.rows[0]).toMatchObject({
        before_amount_paise: "50000",
        after_amount_paise: "75000",
      });

      await client.query("delete from expense where id = $1", [expenseId]);
      const deleted = await client.query(
        "select entity_label from activity_log where entity_id = $1 and action = 'delete'",
        [expenseId],
      );
      expect(deleted.rows).toHaveLength(1);
      expect(deleted.rows[0]!.entity_label).toBe("Grocery");
    });
  });

  it("a teacher has no access to activity_log -- every select returns nothing", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);
      await insertStudent(client); // guarantees at least one row exists

      await impersonate(client, TEACHER_ID);
      const rows = await client.query("select id from activity_log limit 1");
      expect(rows.rows).toHaveLength(0);
    });
  });

  it("an admin's delete from activity_log and update activity_log are both rejected", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      await expect(
        client.query("delete from activity_log"),
      ).rejects.toThrow();
      await expect(
        client.query("update activity_log set summary = 'tampered'"),
      ).rejects.toThrow();
    });
  });

  it("anon reads nothing", async () => {
    await withRollback(client, async () => {
      await client.query("set role anon");
      await expect(
        client.query("select 1 from activity_log limit 1"),
      ).rejects.toThrow();
    });
  });

  it("the label of a deleted student still renders from the log after the student is gone", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const studentId = await insertStudent(client, "Ghost Student");
      await client.query("delete from student where id = $1", [studentId]);

      const rows = await client.query(
        "select entity_label from activity_log where entity_id = $1 and action = 'delete'",
        [studentId],
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0]!.entity_label).toBe("Ghost Student");

      const stillThere = await client.query(
        "select id from student where id = $1",
        [studentId],
      );
      expect(stillThere.rows).toHaveLength(0);
    });
  });

  it("auth.uid() resolves to the approving admin, not the submitting teacher, inside approve_student_submission", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_ID);

      const submission = await client.query<{ id: string }>(
        `insert into student_submission
           (branch_id, submitted_by, admission_no, full_name, guardian_name, phone, class_section,
            academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, pickup_point)
         values ($1, $2, 'LOG-SUB-1', 'Approved Via Trigger', 'Guardian', '9000000101', 'Nursery-A',
                 $3, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Gate')
         returning id`,
        [branchId, TEACHER_ID, academicYearId],
      );

      await impersonate(client, ADMIN_ID);
      const approved = await client.query<{ approve_student_submission: string }>(
        "select approve_student_submission($1)",
        [submission.rows[0]!.id],
      );
      const newStudentId = approved.rows[0]!.approve_student_submission;

      const studentLog = await client.query<{ actor_id: string }>(
        "select actor_id from activity_log where entity = 'student' and entity_id = $1",
        [newStudentId],
      );
      expect(studentLog.rows).toHaveLength(1);
      // This is the fact 12.1 exists to prove empirically: auth.uid() read
      // inside log_activity() -- itself fired from inside the security
      // definer approve_student_submission -- resolves to the admin who
      // clicked Approve, not the teacher whose submitted_by is on the row
      // this insert originated from, and not null.
      expect(studentLog.rows[0]!.actor_id).toBe(ADMIN_ID);
      expect(studentLog.rows[0]!.actor_id).not.toBe(TEACHER_ID);

      const submissionLog = await client.query<{ actor_id: string; summary: string }>(
        "select actor_id, summary from activity_log where entity = 'student_submission' and entity_id = $1 and action = 'update'",
        [submission.rows[0]!.id],
      );
      expect(submissionLog.rows).toHaveLength(1);
      expect(submissionLog.rows[0]!.actor_id).toBe(ADMIN_ID);
      expect(submissionLog.rows[0]!.summary).toContain("Approved");
    });
  });
});
