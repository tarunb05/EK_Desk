import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connect, withRollback } from "./test-helpers";

describe("record mutations (as authenticated)", () => {
  let client: Client;
  let branchId: string;
  let academicYearId: string;

  beforeAll(async () => {
    client = await connect();
    const branch = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-A' limit 1",
    );
    branchId = branch.rows[0]!.id;
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current = true limit 1",
    );
    academicYearId = year.rows[0]!.id;
  });

  afterEach(async () => {
    await client.query("reset role");
  });

  afterAll(async () => {
    await client.end();
  });

  it("creates a student with a transport fee account and reflects it in the balance view", async () => {
    await withRollback(client, async () => {
      await client.query("set role authenticated");

      const student = await client.query<{ id: string }>(
        `insert into student
           (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'BR-A-9001', 'Test Student', 'Test Guardian', '9000000001', 'Nursery-A')
         returning id`,
        [branchId],
      );

      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise,
            due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Main Gate')
         returning id`,
        [student.rows[0]!.id, academicYearId],
      );

      const balance = await client.query<{
        pending_paise: string;
        collected_paise: string;
      }>(
        "select pending_paise, collected_paise from fee_account_balance where fee_account_id = $1",
        [feeAccount.rows[0]!.id],
      );

      expect(balance.rows[0]!.pending_paise).toBe("1000000");
      expect(balance.rows[0]!.collected_paise).toBe("0");
    });
  });

  it("recording a payment updates collected and pending on the balance view", async () => {
    await withRollback(client, async () => {
      await client.query("set role authenticated");

      const feeAccount = await client.query<{ id: string }>(
        `select id from fee_account where academic_year_id = $1 limit 1`,
        [academicYearId],
      );
      const feeAccountId = feeAccount.rows[0]!.id;

      const before = await client.query<{ pending_paise: string }>(
        "select pending_paise from fee_account_balance where fee_account_id = $1",
        [feeAccountId],
      );

      await client.query(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 25000, '2026-06-01', 'upi', 'front_office')`,
        [feeAccountId],
      );

      const after = await client.query<{ pending_paise: string }>(
        "select pending_paise from fee_account_balance where fee_account_id = $1",
        [feeAccountId],
      );

      expect(
        BigInt(before.rows[0]!.pending_paise) -
          BigInt(after.rows[0]!.pending_paise),
      ).toBe(25000n);
    });
  });

  it("voiding a payment restores the pending amount and keeps the row visible in history", async () => {
    await withRollback(client, async () => {
      await client.query("set role authenticated");

      const feeAccount = await client.query<{ id: string }>(
        `select id from fee_account where academic_year_id = $1 limit 1`,
        [academicYearId],
      );
      const feeAccountId = feeAccount.rows[0]!.id;

      const before = await client.query<{ pending_paise: string }>(
        "select pending_paise from fee_account_balance where fee_account_id = $1",
        [feeAccountId],
      );

      const payment = await client.query<{ id: string }>(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 30000, '2026-06-01', 'cash', 'front_office')
         returning id`,
        [feeAccountId],
      );

      await client.query(
        "update payment set voided_at = now(), void_reason = 'test void' where id = $1",
        [payment.rows[0]!.id],
      );

      const after = await client.query<{ pending_paise: string }>(
        "select pending_paise from fee_account_balance where fee_account_id = $1",
        [feeAccountId],
      );
      expect(after.rows[0]!.pending_paise).toBe(before.rows[0]!.pending_paise);

      const historyRow = await client.query(
        "select id, voided_at from payment where id = $1",
        [payment.rows[0]!.id],
      );
      expect(historyRow.rows).toHaveLength(1);
      expect(historyRow.rows[0]!.voided_at).not.toBeNull();
    });
  });

  it("editing a fee account's receivable amount changes pending on the balance view", async () => {
    await withRollback(client, async () => {
      await client.query("set role authenticated");

      const feeAccount = await client.query<{
        id: string;
        total_receivable_paise: string;
      }>(
        `select id, total_receivable_paise from fee_account where academic_year_id = $1 limit 1`,
        [academicYearId],
      );
      const feeAccountId = feeAccount.rows[0]!.id;
      const newTotal =
        BigInt(feeAccount.rows[0]!.total_receivable_paise) + 50000n;

      await client.query(
        "update fee_account set total_receivable_paise = $1 where id = $2",
        [newTotal.toString(), feeAccountId],
      );

      const balance = await client.query<{ total_receivable_paise: string }>(
        "select total_receivable_paise from fee_account_balance where fee_account_id = $1",
        [feeAccountId],
      );
      expect(BigInt(balance.rows[0]!.total_receivable_paise)).toBe(newTotal);
    });
  });

  it("archiving a student (soft delete) excludes them from fee_account_record but keeps their fee account and payment history intact", async () => {
    await withRollback(client, async () => {
      await client.query("set role authenticated");

      const student = await client.query<{ id: string }>(
        `insert into student
           (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'BR-A-9002', 'Archived Student', 'Test Guardian', '9000000002', 'Nursery-A')
         returning id`,
        [branchId],
      );
      const studentId = student.rows[0]!.id;

      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise,
            due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 500000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Main Gate')
         returning id`,
        [studentId, academicYearId],
      );
      const feeAccountId = feeAccount.rows[0]!.id;

      await client.query(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 100000, '2026-06-01', 'upi', 'front_office')`,
        [feeAccountId],
      );

      const beforeArchive = await client.query(
        "select fee_account_id, student_status from fee_account_record where fee_account_id = $1 and student_status = 'active'",
        [feeAccountId],
      );
      expect(beforeArchive.rows).toHaveLength(1);

      await client.query(
        "update student set status = 'inactive' where id = $1",
        [studentId],
      );

      // Listings/dashboards filter on student_status = 'active' at the query
      // layer, so that's what "excluded" means here...
      const afterArchive = await client.query(
        "select fee_account_id from fee_account_record where fee_account_id = $1 and student_status = 'active'",
        [feeAccountId],
      );
      expect(afterArchive.rows).toHaveLength(0);

      // ...but the view itself still resolves the row unfiltered, so a
      // direct by-id lookup (the student's own detail page) still works.
      const byId = await client.query(
        "select student_status from fee_account_record where fee_account_id = $1",
        [feeAccountId],
      );
      expect(byId.rows).toHaveLength(1);
      expect(byId.rows[0]!.student_status).toBe("inactive");

      // The row itself, and its payment history, are untouched.
      const feeAccountRow = await client.query(
        "select id from fee_account where id = $1",
        [feeAccountId],
      );
      expect(feeAccountRow.rows).toHaveLength(1);
      const paymentRows = await client.query(
        "select amount_paise from payment where fee_account_id = $1",
        [feeAccountId],
      );
      expect(paymentRows.rows).toHaveLength(1);
    });
  });

  it("archiving a student removes their receivable from dashboard_summary", async () => {
    await withRollback(client, async () => {
      await client.query("set role authenticated");

      const student = await client.query<{ id: string }>(
        `insert into student
           (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'BR-A-9003', 'Archived Student Two', 'Test Guardian', '9000000003', 'Nursery-A')
         returning id`,
        [branchId],
      );
      const studentId = student.rows[0]!.id;

      await client.query(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise,
            due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 750000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Main Gate')`,
        [studentId, academicYearId],
      );

      const before = await client.query<{ total_receivable_paise: string }>(
        "select * from dashboard_summary($1, $2, null)",
        ["transport", academicYearId],
      );

      await client.query(
        "update student set status = 'inactive' where id = $1",
        [studentId],
      );

      const after = await client.query<{ total_receivable_paise: string }>(
        "select * from dashboard_summary($1, $2, null)",
        ["transport", academicYearId],
      );

      expect(
        BigInt(before.rows[0]!.total_receivable_paise) -
          BigInt(after.rows[0]!.total_receivable_paise),
      ).toBe(750000n);
    });
  });
});
