import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000002";

describe("payment_request RLS and constraints (phase 15.1)", () => {
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
      "select id from academic_year where is_current limit 1",
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

  async function seedFeeAccount(client: Client, admissionNo: string) {
    const student = await client.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'PR Student', 'Guardian', '9111111111', 'Nursery-A')
       returning id`,
      [branchAId, admissionNo],
    );
    const feeAccount = await client.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
       values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
       returning id`,
      [student.rows[0]!.id, academicYearId],
    );
    return feeAccount.rows[0]!.id;
  }

  it("a teacher reads no payment_request rows at all", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const feeAccountId = await seedFeeAccount(client, "PR-TEACHER-READ");

      await impersonate(client, ADMIN_ID);
      await client.query(
        `insert into payment_request (fee_account_id, amount_paise, expires_at, created_by)
         values ($1, 50000, now() + interval '7 days', $2)`,
        [feeAccountId, ADMIN_ID],
      );

      await impersonate(client, TEACHER_A_ID);
      const rows = await client.query("select id from payment_request");
      expect(rows.rows).toHaveLength(0);
    });
  });

  it("a teacher cannot insert into payment_request, even for their own branch's fee account", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const feeAccountId = await seedFeeAccount(client, "PR-TEACHER-WRITE");

      await impersonate(client, TEACHER_A_ID);
      await expect(
        client.query(
          `insert into payment_request (fee_account_id, amount_paise, expires_at, created_by)
           values ($1, 50000, now() + interval '7 days', $2)`,
          [feeAccountId, TEACHER_A_ID],
        ),
      ).rejects.toThrow();
    });
  });

  it("an admin can create, read, and update a payment_request", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const feeAccountId = await seedFeeAccount(client, "PR-ADMIN-CRUD");

      await impersonate(client, ADMIN_ID);
      const created = await client.query<{ id: string }>(
        `insert into payment_request (fee_account_id, amount_paise, expires_at, created_by)
         values ($1, 50000, now() + interval '7 days', $2)
         returning id`,
        [feeAccountId, ADMIN_ID],
      );
      expect(created.rows).toHaveLength(1);

      const updated = await client.query(
        "update payment_request set status = 'cancelled', cancelled_reason = 'test' where id = $1",
        [created.rows[0]!.id],
      );
      expect(updated.rowCount).toBe(1);
    });
  });

  it("the partial unique index allows only one open request per fee account", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const feeAccountId = await seedFeeAccount(client, "PR-ONE-OPEN");

      await impersonate(client, ADMIN_ID);
      await client.query(
        `insert into payment_request (fee_account_id, amount_paise, expires_at, created_by)
         values ($1, 50000, now() + interval '7 days', $2)`,
        [feeAccountId, ADMIN_ID],
      );

      // A savepoint isolates the expected failure, same pattern as the
      // concurrent-double-approve test in submissions.integration.test.ts
      // -- Postgres aborts the whole transaction on an unhandled error
      // otherwise.
      await client.query("savepoint before_second_open");
      await expect(
        client.query(
          `insert into payment_request (fee_account_id, amount_paise, expires_at, created_by)
           values ($1, 30000, now() + interval '3 days', $2)`,
          [feeAccountId, ADMIN_ID],
        ),
      ).rejects.toThrow(/payment_request_one_open_per_account/);
      await client.query("rollback to savepoint before_second_open");

      const openRequests = await client.query(
        "select id from payment_request where fee_account_id = $1 and status = 'open'",
        [feeAccountId],
      );
      expect(openRequests.rows).toHaveLength(1);
    });
  });

  it("a cancelled request doesn't block a new open one for the same fee account", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const feeAccountId = await seedFeeAccount(client, "PR-REOPEN");

      await impersonate(client, ADMIN_ID);
      const first = await client.query<{ id: string }>(
        `insert into payment_request (fee_account_id, amount_paise, expires_at, created_by)
         values ($1, 50000, now() + interval '7 days', $2)
         returning id`,
        [feeAccountId, ADMIN_ID],
      );
      await client.query(
        "update payment_request set status = 'cancelled', cancelled_reason = 'superseded' where id = $1",
        [first.rows[0]!.id],
      );

      const second = await client.query(
        `insert into payment_request (fee_account_id, amount_paise, expires_at, created_by)
         values ($1, 40000, now() + interval '7 days', $2)`,
        [feeAccountId, ADMIN_ID],
      );
      expect(second.rowCount).toBe(1);
    });
  });

  it("an admin has no grant on webhook_event", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);
      await expect(
        client.query("select 1 from webhook_event"),
      ).rejects.toThrow();
    });
  });

  it("a teacher has no grant on webhook_event", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);
      await expect(
        client.query("select 1 from webhook_event"),
      ).rejects.toThrow();
    });
  });
});
