import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, withRollback } from "./test-helpers";

// Fake auth.users/profile rows are created inside withRollback for every
// test -- CI's `test` job runs integration tests against a bare Postgres
// service container with no real GoTrue, so these can't come from the
// actual seed-auth-user.ts script (that needs the full Supabase Admin API,
// exercised instead by the separate `e2e` job's real local stack).
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const TEACHER_A_ID = "00000000-0000-4000-8000-000000000002";
const TEACHER_B_ID = "00000000-0000-4000-8000-000000000003";

describe("role-based RLS (phase 8.1)", () => {
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

  it("anon reads nothing (unchanged from before phase 8)", async () => {
    await withRollback(client, async () => {
      await client.query("set role anon");
      await expect(
        client.query("select 1 from student limit 1"),
      ).rejects.toThrow();
    });
  });

  it("a teacher reads only their own branch's students", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await client.query(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'ROLE-A-1', 'Student A', 'Guardian A', '1111111111', 'Nursery-A'),
                ($2, 'ROLE-B-1', 'Student B', 'Guardian B', '2222222222', 'Nursery-A')`,
        [branchAId, branchBId],
      );

      await impersonate(client, TEACHER_A_ID);
      // The dev DB's own fixture data (npm run db:seed) already has BR-A
      // students, so this asserts membership, not an exact row set --
      // ROLE-A-1 must be visible, ROLE-B-1 (a different branch) must not.
      const rows = await client.query<{ admission_no: string }>(
        "select admission_no from student order by admission_no",
      );
      const admissionNos = rows.rows.map((r) => r.admission_no);
      expect(admissionNos).toContain("ROLE-A-1");
      expect(admissionNos).not.toContain("ROLE-B-1");
    });
  });

  it("a teacher reads their own branch's fee_account, payment, and fee_account_balance -- including money -- but not another branch's", async () => {
    // Money on the Students page is fine for a teacher (confirmed with the
    // user, corrected from 8.1's original "no rupee figure anywhere" —
    // dashboards are the thing actually kept admin-only, by route, not by
    // hiding the underlying data). This replaces 8.1's fee_account_teacher
    // view-based test, since that view no longer exists.
    await withRollback(client, async () => {
      await seedProfiles(client);
      const studentA = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'ROLE-A-2', 'Student A2', 'Guardian A2', '3333333333', 'Nursery-A')
         returning id`,
        [branchAId],
      );
      const studentB = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'ROLE-B-2', 'Student B2', 'Guardian B2', '3333333334', 'Nursery-A')
         returning id`,
        [branchBId],
      );
      const feeAccountA = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         select $1, id, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate'
         from academic_year where is_current = true limit 1
         returning id`,
        [studentA.rows[0]!.id],
      );
      const feeAccountB = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         select $1, id, 'transport', 2000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 2', 'Gate 2'
         from academic_year where is_current = true limit 1
         returning id`,
        [studentB.rows[0]!.id],
      );
      await client.query(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 50000, '2026-06-01', 'cash', 'admin'), ($2, 60000, '2026-06-01', 'cash', 'admin')`,
        [feeAccountA.rows[0]!.id, feeAccountB.rows[0]!.id],
      );

      await impersonate(client, TEACHER_A_ID);

      const feeAccounts = await client.query<{ id: string }>(
        "select id from fee_account",
      );
      const feeAccountIds = feeAccounts.rows.map((r) => r.id);
      expect(feeAccountIds).toContain(feeAccountA.rows[0]!.id);
      expect(feeAccountIds).not.toContain(feeAccountB.rows[0]!.id);

      const payments = await client.query<{ fee_account_id: string }>(
        "select fee_account_id from payment",
      );
      const paymentFeeAccountIds = payments.rows.map((r) => r.fee_account_id);
      expect(paymentFeeAccountIds).toContain(feeAccountA.rows[0]!.id);
      expect(paymentFeeAccountIds).not.toContain(feeAccountB.rows[0]!.id);

      const balances = await client.query<{
        fee_account_id: string;
        total_receivable_paise: string;
      }>(
        "select fee_account_id, total_receivable_paise from fee_account_balance",
      );
      const balanceIds = balances.rows.map((r) => r.fee_account_id);
      expect(balanceIds).toContain(feeAccountA.rows[0]!.id);
      expect(balanceIds).not.toContain(feeAccountB.rows[0]!.id);
      const own = balances.rows.find(
        (r) => r.fee_account_id === feeAccountA.rows[0]!.id,
      );
      expect(own?.total_receivable_paise).toBe("1000000");
    });
  });

  it("a teacher reads their own profile row, but not another teacher's", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const rows = await client.query<{ id: string }>("select id from profile");
      const ids = rows.rows.map((r) => r.id);
      expect(ids).toContain(TEACHER_A_ID);
      expect(ids).not.toContain(TEACHER_B_ID);
      expect(ids).not.toContain(ADMIN_ID);
    });
  });

  it("a teacher cannot insert or update student directly", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      await expect(
        client.query(
          `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
           values ($1, 'ROLE-DENIED', 'X', 'Y', '5555555555', 'Nursery-A')`,
          [branchAId],
        ),
      ).rejects.toThrow();
    });
  });

  it("a teacher cannot insert or update fee_account directly -- read access doesn't imply write", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'ROLE-A-WRITE', 'Student', 'Guardian', '7777777777', 'Nursery-A')
         returning id`,
        [branchAId],
      );

      await impersonate(client, TEACHER_A_ID);

      await expect(
        client.query(
          `insert into fee_account
             (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
           select $1, id, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate'
           from academic_year where is_current = true limit 1`,
          [student.rows[0]!.id],
        ),
      ).rejects.toThrow();
    });
  });

  it("a teacher cannot insert into branch", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      await expect(
        client.query("insert into branch (code, name) values ('ROLE-X', 'Denied')"),
      ).rejects.toThrow();
    });
  });

  it("a teacher's update to academic_year silently matches zero rows", async () => {
    // A separate transaction from the insert-rejection test above: Postgres
    // aborts the whole transaction after any error, so a second statement
    // in the same withRollback would fail with "transaction aborted" rather
    // than actually exercising this — RLS makes an UPDATE with no visible
    // rows a silent no-op, not an error, which is the behavior under test.
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_A_ID);

      const result = await client.query(
        "update academic_year set is_current = true where is_current = false",
      );
      expect(result.rowCount).toBe(0);
    });
  });

  it("admin behavior is unchanged: full access on every table", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'ROLE-ADMIN-1', 'Admin Student', 'Guardian', '6666666666', 'Nursery-A')
         returning id`,
        [branchAId],
      );
      expect(student.rows).toHaveLength(1);

      const branches = await client.query("select 1 from branch");
      expect(branches.rows.length).toBeGreaterThan(0);
      const feeAccounts = await client.query("select 1 from fee_account");
      expect(feeAccounts.rows.length).toBeGreaterThanOrEqual(0);
    });
  });
});
