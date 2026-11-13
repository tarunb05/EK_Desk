import type { Client } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { connect, impersonate, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000601";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000602";
const TEACHER_B_ID = "00000000-0000-4000-8000-000000000603";

describe("enrollment delete submission (teacher-requested, admin-approved)", () => {
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
    const a = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-A' limit 1",
    );
    branchAId = a.rows[0]!.id;
    const b = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-B' limit 1",
    );
    branchBId = b.rows[0]!.id;
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current limit 1",
    );
    academicYearId = year.rows[0]!.id;
  });

  async function seedProfiles(c: Client) {
    await c.query(
      `insert into auth.users (id) values ($1), ($2), ($3) on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_A_ID, TEACHER_B_ID],
    );
    await c.query(
      `insert into profile (id, role, branch_id, full_name) values
         ($1, 'admin', null, 'Test Admin'),
         ($2, 'teacher', $4, 'Test Teacher A'),
         ($3, 'teacher', $5, 'Test Teacher B')
       on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_A_ID, TEACHER_B_ID, branchAId, branchBId],
    );
  }

  // A student with a daycare stint and a transport enrollment, so deleting
  // one can be shown to leave the other.
  async function seedStudent(c: Client, branchId: string) {
    const student = await c.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Enrollment Delete Test', 'Guardian', '9000000801', 'Nursery-A')
       returning id`,
      [branchId, `ED-${Math.random().toString(36).slice(2, 8)}`],
    );
    const daycare = await c.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, slot)
       values ($1, $2, 'daycare', 500000, '2026-12-01', '2026-12-01', '2026-12-31', 'Full day')
       returning id`,
      [student.rows[0]!.id, academicYearId],
    );
    const transport = await c.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
       values ($1, $2, 'transport', 900000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
       returning id`,
      [student.rows[0]!.id, academicYearId],
    );
    await c.query(
      `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
       values ($1, 100000, '2026-12-02', 'cash', 'Test')`,
      [daycare.rows[0]!.id],
    );
    return {
      studentId: student.rows[0]!.id,
      daycareId: daycare.rows[0]!.id,
      transportId: transport.rows[0]!.id,
    };
  }

  const insertSubmission = `
    insert into enrollment_delete_submission
      (fee_account_id, branch_id, submitted_by, student_full_name, student_admission_no, enrollment_label)
    values ($1, $2, $3, 'Enrollment Delete Test', 'ED-X', 'Daycare · 1 Dec – 31 Dec 2026')
    returning id`;

  it("a teacher can request deletion of an enrollment in their own branch", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { daycareId } = await seedStudent(client, branchAId);
      await impersonate(client, TEACHER_A_ID);
      const result = await client.query(insertSubmission, [
        daycareId,
        branchAId,
        TEACHER_A_ID,
      ]);
      expect(result.rowCount).toBe(1);
    });
  });

  it("a teacher can't request deletion in another branch", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { daycareId } = await seedStudent(client, branchBId);
      await impersonate(client, TEACHER_A_ID);
      await expect(
        client.query(insertSubmission, [daycareId, branchBId, TEACHER_A_ID]),
      ).rejects.toThrow();
    });
  });

  it("only one request can be pending per enrollment", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { daycareId } = await seedStudent(client, branchAId);
      await impersonate(client, TEACHER_A_ID);
      await client.query(insertSubmission, [
        daycareId,
        branchAId,
        TEACHER_A_ID,
      ]);
      await expect(
        client.query(insertSubmission, [daycareId, branchAId, TEACHER_A_ID]),
      ).rejects.toThrow(/duplicate key|unique/i);
    });
  });

  it("another teacher can't see the request", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { daycareId } = await seedStudent(client, branchAId);
      await impersonate(client, TEACHER_A_ID);
      await client.query(insertSubmission, [
        daycareId,
        branchAId,
        TEACHER_A_ID,
      ]);
      await client.query("reset role");
      await impersonate(client, TEACHER_B_ID);
      const rows = await client.query(
        "select id from enrollment_delete_submission",
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("approving deletes only that enrollment and its payments, and keeps the request on record", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { studentId, daycareId, transportId } = await seedStudent(
        client,
        branchAId,
      );
      const submission = await client.query<{ id: string }>(insertSubmission, [
        daycareId,
        branchAId,
        TEACHER_A_ID,
      ]);

      await impersonate(client, ADMIN_ID);
      await client.query("select approve_enrollment_delete($1)", [
        submission.rows[0]!.id,
      ]);
      await client.query("reset role");

      const accounts = await client.query<{ id: string }>(
        "select id from fee_account where student_id = $1",
        [studentId],
      );
      expect(accounts.rows.map((r) => r.id)).toEqual([transportId]);
      const payments = await client.query(
        "select 1 from payment where fee_account_id = $1",
        [daycareId],
      );
      expect(payments.rowCount).toBe(0);
      const record = await client.query<{
        status: string;
        fee_account_id: string | null;
        enrollment_label: string;
      }>(
        "select status, fee_account_id, enrollment_label from enrollment_delete_submission where id = $1",
        [submission.rows[0]!.id],
      );
      expect(record.rows[0]).toMatchObject({
        status: "approved",
        fee_account_id: null,
        enrollment_label: "Daycare · 1 Dec – 31 Dec 2026",
      });
    });
  });

  it("a teacher can't approve", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { daycareId } = await seedStudent(client, branchAId);
      const submission = await client.query<{ id: string }>(insertSubmission, [
        daycareId,
        branchAId,
        TEACHER_A_ID,
      ]);
      await impersonate(client, TEACHER_A_ID);
      await expect(
        client.query("select approve_enrollment_delete($1)", [
          submission.rows[0]!.id,
        ]),
      ).rejects.toThrow(/only an admin/i);
    });
  });

  it("approval is refused while the enrollment has a confirmed payment, and the request stays pending", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const { daycareId } = await seedStudent(client, branchAId);
      const collection = await client.query<{ id: string }>(
        `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
         values ($1, 'ED Account', 'ed@upi', 'Payee', $2) returning id`,
        [branchAId, ADMIN_ID],
      );
      const request = await client.query<{ id: string }>(
        `insert into payment_request
           (fee_account_id, collection_account_id, reference_code, amount_paise,
            include_upi, include_bank, status, closed_reason, token_hash, expires_at, created_by)
         values ($1, $2, 'EK-EDDEL', 100000, true, false, 'closed', 'paid',
                $3, now() + interval '7 days', $4) returning id`,
        [
          daycareId,
          collection.rows[0]!.id,
          Buffer.from("eddel001", "utf8"),
          ADMIN_ID,
        ],
      );
      await client.query(
        `insert into payment_claim
           (payment_request_id, source, utr, claimed_amount_paise, claimed_paid_on, status, reviewed_by, reviewed_at)
         values ($1, 'parent_page', 'UTRED000001', 100000, current_date, 'confirmed', $2, now())`,
        [request.rows[0]!.id, ADMIN_ID],
      );
      const submission = await client.query<{ id: string }>(insertSubmission, [
        daycareId,
        branchAId,
        TEACHER_A_ID,
      ]);

      await impersonate(client, ADMIN_ID);
      await expect(
        client.query("select approve_enrollment_delete($1)", [
          submission.rows[0]!.id,
        ]),
      ).rejects.toThrow(/confirmed payment/i);
    });
  });
});
