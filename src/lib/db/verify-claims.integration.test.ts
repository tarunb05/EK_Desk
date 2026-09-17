import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000501";
const TEACHER_ID = "00000000-0000-4000-8000-000000000502";

describe("verify claims: confirm/reject, hard-delete guard, directory markers (phase 15.5)", () => {
  let client: Client;
  let branchId: string;
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
    const branch = await client.query<{ id: string }>(
      "select id from branch where code = 'BR-A' limit 1",
    );
    branchId = branch.rows[0]!.id;
    const year = await client.query<{ id: string }>(
      "select id from academic_year where is_current limit 1",
    );
    academicYearId = year.rows[0]!.id;
  });

  async function seedProfiles(c: Client) {
    await c.query(
      `insert into auth.users (id) values ($1), ($2) on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_ID],
    );
    await c.query(
      `insert into profile (id, role, branch_id, full_name) values
         ($1, 'admin', null, 'Test Admin'),
         ($2, 'teacher', $3, 'Test Teacher')
       on conflict (id) do nothing`,
      [ADMIN_ID, TEACHER_ID, branchId],
    );
  }

  // Builds student/fee_account/collection_account/payment_request/
  // payment_claim (pending) as admin, and returns every id a confirm/reject
  // test needs. Every request is for 400000 paise (₹4,000) against a
  // 1000000-paise (₹10,000) receivable, so there's headroom above and
  // below the request amount for the close/keep-open and overpayment
  // cases.
  async function seedClaim(
    c: Client,
    overrides: {
      admissionNo?: string;
      requestStatus?: string;
      utr?: string;
      claimedAmountPaise?: number;
    } = {},
  ) {
    // reset role first: seedProfiles' own auth.users insert needs the raw
    // postgres role, and a *previous* call to seedClaim in the same
    // transaction leaves the session as 'authenticated' -- harmless no-op
    // the very first time, when role is already the session default.
    await c.query("reset role");
    await seedProfiles(c);
    await impersonate(c, ADMIN_ID);

    const student = await c.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Verify Test Child', 'Guardian', '9000000701', 'Nursery-A')
       returning id`,
      [branchId, overrides.admissionNo ?? `VC-${Math.random().toString(36).slice(2, 8)}`],
    );
    const feeAccount = await c.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
       values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
       returning id`,
      [student.rows[0]!.id, academicYearId],
    );
    const collectionAccount = await c.query<{ id: string }>(
      `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
       values ($1, 'Verify Test Account', 'verify@upi', 'Payee', $2)
       returning id`,
      [branchId, ADMIN_ID],
    );
    const status = overrides.requestStatus ?? "open";
    const closedReason = status === "open" ? null : "cancelled";
    const request = await c.query<{ id: string }>(
      `insert into payment_request
         (fee_account_id, collection_account_id, reference_code, amount_paise,
          include_upi, include_bank, status, closed_reason, token_hash, expires_at, created_by)
       values ($1, $2, $3, 400000, true, false, $4, $5,
               $6, now() + interval '7 days', $7)
       returning id`,
      [
        feeAccount.rows[0]!.id,
        collectionAccount.rows[0]!.id,
        `EK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        status,
        closedReason,
        Buffer.from(Math.random().toString(36).slice(2, 10), "utf8"),
        ADMIN_ID,
      ],
    );
    const claim = await c.query<{ id: string }>(
      `insert into payment_claim
         (payment_request_id, source, utr, claimed_amount_paise, claimed_paid_on)
       values ($1, 'parent_page', $2, $3, current_date)
       returning id`,
      [
        request.rows[0]!.id,
        overrides.utr ?? `UTR${Math.random().toString().slice(2, 14)}`,
        overrides.claimedAmountPaise ?? 400000,
      ],
    );

    return {
      studentId: student.rows[0]!.id,
      feeAccountId: feeAccount.rows[0]!.id,
      collectionAccountId: collectionAccount.rows[0]!.id,
      paymentRequestId: request.rows[0]!.id,
      claimId: claim.rows[0]!.id,
    };
  }

  it("confirms a claim: inserts one payment, marks the claim confirmed, closes the request when asked", async () => {
    await withRollback(client, async () => {
      const fixture = await seedClaim(client);

      const result = await client.query<{ requestStatus: string }>(
        `select (confirm_payment_claim($1, 400000, current_date, 'upi', true)->>'requestStatus') as "requestStatus"`,
        [fixture.claimId],
      );
      expect(result.rows[0]!.requestStatus).toBe("closed");

      const payments = await client.query(
        "select method, reference from payment where fee_account_id = $1",
        [fixture.feeAccountId],
      );
      expect(payments.rows).toHaveLength(1);
      expect(payments.rows[0]!.method).toBe("upi");

      const claim = await client.query(
        "select status, payment_id from payment_claim where id = $1",
        [fixture.claimId],
      );
      expect(claim.rows[0]!.status).toBe("confirmed");
      expect(claim.rows[0]!.payment_id).not.toBeNull();

      const request = await client.query(
        "select status, closed_reason, amount_paise from payment_request where id = $1",
        [fixture.paymentRequestId],
      );
      expect(request.rows[0]!.status).toBe("closed");
      expect(request.rows[0]!.closed_reason).toBe("paid");
      expect(Number(request.rows[0]!.amount_paise)).toBe(400000);
    });
  });

  it("leaves the request open, with its amount unchanged, when the admin chooses to keep it open", async () => {
    await withRollback(client, async () => {
      const fixture = await seedClaim(client);

      await client.query(
        `select confirm_payment_claim($1, 200000, current_date, 'upi', false)`,
        [fixture.claimId],
      );

      const request = await client.query(
        "select status, closed_reason, amount_paise from payment_request where id = $1",
        [fixture.paymentRequestId],
      );
      expect(request.rows[0]!.status).toBe("open");
      expect(request.rows[0]!.closed_reason).toBeNull();
      expect(Number(request.rows[0]!.amount_paise)).toBe(400000);
    });
  });

  it("rejects re-confirming an already-reviewed claim", async () => {
    await withRollback(client, async () => {
      const fixture = await seedClaim(client);
      await client.query(
        `select confirm_payment_claim($1, 400000, current_date, 'upi', true)`,
        [fixture.claimId],
      );

      await expect(
        client.query(
          `select confirm_payment_claim($1, 400000, current_date, 'upi', true)`,
          [fixture.claimId],
        ),
      ).rejects.toThrow(/already been reviewed/i);
    });
  });

  it("two concurrent confirms of the same claim leave exactly one payment", async () => {
    const clientA = await connect();
    const clientB = await connect();
    let feeAccountId: string | undefined;
    let studentId: string | undefined;
    let collectionAccountId: string | undefined;
    try {
      await clientA.query("begin");
      await impersonateAdmin(clientA);

      // A genuine two-connection race needs two independently-committing
      // transactions, which means the fixture below (and the winning
      // confirm) are real commits, not something withRollback undoes.
      // Vitest runs test files in parallel by default, so sharing the
      // shared "current" academic year would briefly add this fixture's
      // receivable to a dashboard-aggregate test's own before/after
      // snapshot in a completely different file, mid-race -- same
      // reasoning, same dedicated fixture, as every other real-commit race
      // test in this suite (see whatsapp-payment-requests.integration.test.ts).
      const academicYear = await clientA.query<{ id: string }>(
        `insert into academic_year (label, starts_on, ends_on, is_current)
         values ('Race Test Year', '2020-04-01', '2021-03-31', false)
         on conflict (label) do update set label = excluded.label
         returning id`,
      );
      const raceYearId = academicYear.rows[0]!.id;

      const student = await clientA.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'VC-RACE-1', 'Race Child', 'Guardian', '9000000703', 'Nursery-A')
         returning id`,
        [branchId],
      );
      studentId = student.rows[0]!.id;
      const feeAccount = await clientA.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2020-06-01', '2020-04-01', '2021-03-31', 'Route 1', 'Gate')
         returning id`,
        [studentId, raceYearId],
      );
      feeAccountId = feeAccount.rows[0]!.id;
      const collectionAccount = await clientA.query<{ id: string }>(
        `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
         values ($1, 'Race', 'race@upi', 'Race Payee', $2)
         returning id`,
        [branchId, ADMIN_ID],
      );
      collectionAccountId = collectionAccount.rows[0]!.id;
      const request = await clientA.query<{ id: string }>(
        `insert into payment_request
           (fee_account_id, collection_account_id, reference_code, amount_paise,
            include_upi, include_bank, status, token_hash, expires_at, created_by)
         values ($1, $2, 'EK-VCRACE', 400000, true, false, 'open', $3, now() + interval '7 days', $4)
         returning id`,
        [feeAccountId, collectionAccountId, Buffer.from("vcrace01"), ADMIN_ID],
      );
      const claim = await clientA.query<{ id: string }>(
        `insert into payment_claim (payment_request_id, source, utr, claimed_amount_paise, claimed_paid_on)
         values ($1, 'parent_page', 'UTR000000RACE', 400000, '2020-06-01')
         returning id`,
        [request.rows[0]!.id],
      );
      const claimId = claim.rows[0]!.id;
      await clientA.query("commit");

      await clientA.query("reset role");
      await clientA.query("begin");
      await impersonate(clientA, ADMIN_ID);
      await clientB.query("begin");
      await impersonate(clientB, ADMIN_ID);

      const confirmA = clientA.query(
        `select confirm_payment_claim($1, 400000, '2020-06-01', 'upi', true)`,
        [claimId],
      );
      const confirmB = clientB.query(
        `select confirm_payment_claim($1, 400000, '2020-06-01', 'upi', true)`,
        [claimId],
      );
      confirmB.catch(() => {});

      await confirmA;
      await clientA.query("commit");

      await expect(confirmB).rejects.toThrow(/already been reviewed/i);
      await clientB.query("rollback");

      await clientA.query("reset role");
      await clientA.query("begin");
      await impersonate(clientA, ADMIN_ID);
      const payments = await clientA.query(
        "select count(*)::int as count from payment where fee_account_id = $1",
        [feeAccountId],
      );
      expect(payments.rows[0]!.count).toBe(1);
      await clientA.query("commit");
    } finally {
      try {
        await clientA.query("rollback");
      } catch {
        /* already committed/rolled back above */
      }
      try {
        await clientB.query("rollback");
      } catch {
        /* already rolled back above */
      }

      // Cleanup as the raw postgres role, bypassing RLS/grants entirely --
      // same pattern and dependency order as every other real-commit race
      // test's own teardown. 'Race Test Year' and the ADMIN_ID/TEACHER_ID
      // profiles are left in place permanently (idempotent, and
      // activity_log has no cascade from either), matching precedent.
      if (feeAccountId) {
        await clientA.query("reset role");
        await clientA.query(
          "delete from payment_claim where payment_request_id in (select id from payment_request where fee_account_id = $1)",
          [feeAccountId],
        );
        await clientA.query("delete from payment where fee_account_id = $1", [
          feeAccountId,
        ]);
        await clientA.query("delete from payment_request where fee_account_id = $1", [
          feeAccountId,
        ]);
        if (collectionAccountId) {
          await clientA.query("delete from collection_account where id = $1", [
            collectionAccountId,
          ]);
        }
        await clientA.query("delete from fee_account where id = $1", [feeAccountId]);
        if (studentId) {
          await clientA.query("delete from student where id = $1", [studentId]);
        }
      }

      await clientA.end();
      await clientB.end();
    }
  });

  it("the same UTR can't be confirmed twice", async () => {
    await withRollback(client, async () => {
      const utr = `UTR${Math.random().toString().slice(2, 14)}`;
      const first = await seedClaim(client, { admissionNo: "VC-UTR-1", utr });
      const second = await seedClaim(client, { admissionNo: "VC-UTR-2", utr });

      await client.query(
        `select confirm_payment_claim($1, 400000, current_date, 'upi', true)`,
        [first.claimId],
      );

      // Confirming the first claim already auto-rejects any other pending
      // claim sharing the same UTR (see the next test) -- so the second
      // claim is 'rejected', not 'pending', by the time we'd try to
      // confirm it. Force the scenario the unique index itself guards
      // against by resetting it back to pending first.
      await client.query(
        "update payment_claim set status = 'pending', reviewed_by = null, reviewed_at = null where id = $1",
        [second.claimId],
      );

      // bank_transfer, not upi -- isolates this test to the
      // payment_claim_utr_confirmed_once index specifically. Using 'upi'
      // again would hit payment_reference_unique_upi_non_voided first
      // (both payments would share the same reference=utr AND
      // method='upi'), which is a real, separate protection but not the
      // one this test is naming.
      await expect(
        client.query(
          `select confirm_payment_claim($1, 400000, current_date, 'bank_transfer', true)`,
          [second.claimId],
        ),
      ).rejects.toThrow(/already been confirmed/i);
    });
  });

  it("confirming a claim automatically rejects other pending claims sharing the same UTR", async () => {
    await withRollback(client, async () => {
      const utr = `UTR${Math.random().toString().slice(2, 14)}`;
      const first = await seedClaim(client, { admissionNo: "VC-DUP-1", utr });
      const second = await seedClaim(client, { admissionNo: "VC-DUP-2", utr });

      await client.query(
        `select confirm_payment_claim($1, 400000, current_date, 'upi', true)`,
        [first.claimId],
      );

      const secondClaim = await client.query(
        "select status, reject_reason from payment_claim where id = $1",
        [second.claimId],
      );
      expect(secondClaim.rows[0]!.status).toBe("rejected");
      expect(secondClaim.rows[0]!.reject_reason).toMatch(/different claim/i);
    });
  });

  it("confirming a claim on a closed or expired request still succeeds", async () => {
    await withRollback(client, async () => {
      const fixture = await seedClaim(client, {
        admissionNo: "VC-CLOSED",
        requestStatus: "closed",
      });

      await client.query(
        `select confirm_payment_claim($1, 400000, current_date, 'upi', false)`,
        [fixture.claimId],
      );

      const claim = await client.query(
        "select status from payment_claim where id = $1",
        [fixture.claimId],
      );
      expect(claim.rows[0]!.status).toBe("confirmed");
    });
  });

  it("overpayment leaves pending negative without erroring", async () => {
    await withRollback(client, async () => {
      const fixture = await seedClaim(client, { claimedAmountPaise: 1200000 });

      await client.query(
        `select confirm_payment_claim($1, 1200000, current_date, 'upi', true)`,
        [fixture.claimId],
      );

      const balance = await client.query(
        "select pending_paise from fee_account_balance where fee_account_id = $1",
        [fixture.feeAccountId],
      );
      expect(Number(balance.rows[0]!.pending_paise)).toBeLessThan(0);
    });
  });

  it("enter_and_confirm_claim records one already-confirmed admin_entered claim and one payment", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'VC-ENTER', 'Verify Test Child', 'Guardian', '9000000702', 'Nursery-A')
         returning id`,
        [branchId],
      );
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [student.rows[0]!.id, academicYearId],
      );
      const collectionAccount = await client.query<{ id: string }>(
        `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
         values ($1, 'Verify Test Account', 'verify@upi', 'Payee', $2)
         returning id`,
        [branchId, ADMIN_ID],
      );
      const request = await client.query<{ id: string }>(
        `insert into payment_request
           (fee_account_id, collection_account_id, reference_code, amount_paise,
            include_upi, include_bank, status, token_hash, expires_at, created_by)
         values ($1, $2, 'EK-ENTER1', 400000, true, false, 'open', $3, now() + interval '7 days', $4)
         returning id`,
        [feeAccount.rows[0]!.id, collectionAccount.rows[0]!.id, Buffer.from("entertoken"), ADMIN_ID],
      );

      const result = await client.query<{ requestStatus: string }>(
        `select (enter_and_confirm_claim($1, 'UTR000000ENTER', 400000, current_date, 400000, current_date, 'upi', true)->>'requestStatus') as "requestStatus"`,
        [request.rows[0]!.id],
      );
      expect(result.rows[0]!.requestStatus).toBe("closed");

      const claims = await client.query(
        "select source, status from payment_claim where payment_request_id = $1",
        [request.rows[0]!.id],
      );
      expect(claims.rows).toHaveLength(1);
      expect(claims.rows[0]!.source).toBe("admin_entered");
      expect(claims.rows[0]!.status).toBe("confirmed");

      const payments = await client.query(
        "select count(*)::int as count from payment where fee_account_id = $1",
        [feeAccount.rows[0]!.id],
      );
      expect(payments.rows[0]!.count).toBe(1);
    });
  });

  it("hard_delete_student succeeds with no confirmed claims, and blocks once one exists even after the request closes", async () => {
    await withRollback(client, async () => {
      // A merely-pending claim (never confirmed) doesn't block -- only a
      // 'confirmed' one does. admin has no delete grant on payment_claim at
      // all (claims are never deleted, only rejected), so this leaves the
      // claim row in place rather than trying to remove it.
      const fixture = await seedClaim(client, { admissionNo: "VC-DELETE-OK" });
      await client.query(`select hard_delete_student($1)`, [fixture.studentId]);

      const gone = await client.query("select 1 from student where id = $1", [
        fixture.studentId,
      ]);
      expect(gone.rows).toHaveLength(0);
    });

    await withRollback(client, async () => {
      const fixture = await seedClaim(client, { admissionNo: "VC-DELETE-BLOCKED" });
      await client.query(
        `select confirm_payment_claim($1, 400000, current_date, 'upi', true)`,
        [fixture.claimId],
      );

      // An expected exception from a query aborts the rest of the
      // transaction unless it's wrapped in its own savepoint -- same
      // pattern as every other "expect this to fail, then keep going in
      // the same transaction" check in this test suite.
      await client.query("savepoint before_blocked_delete");
      await expect(
        client.query(`select hard_delete_student($1)`, [fixture.studentId]),
      ).rejects.toThrow(/confirmed payment/i);
      await client.query("rollback to savepoint before_blocked_delete");

      const stillThere = await client.query("select 1 from student where id = $1", [
        fixture.studentId,
      ]);
      expect(stillThere.rows).toHaveLength(1);
    });
  });

  it("a teacher can't call confirm_payment_claim or hard_delete_student", async () => {
    await withRollback(client, async () => {
      const fixture = await seedClaim(client, { admissionNo: "VC-TEACHER" });
      await impersonate(client, TEACHER_ID);

      await client.query("savepoint before_denied_confirm");
      await expect(
        client.query(
          `select confirm_payment_claim($1, 400000, current_date, 'upi', true)`,
          [fixture.claimId],
        ),
      ).rejects.toThrow(/only an admin/i);
      await client.query("rollback to savepoint before_denied_confirm");

      await client.query("savepoint before_denied_delete");
      await expect(
        client.query(`select hard_delete_student($1)`, [fixture.studentId]),
      ).rejects.toThrow(/only an admin/i);
      await client.query("rollback to savepoint before_denied_delete");
    });
  });

  it("student_directory's paymentRequestStatus reads none/open/reported correctly", async () => {
    await withRollback(client, async () => {
      // admin has no delete grant on payment_claim/payment_request
      // directly (matching the "claims are never deleted" rule) -- cancel
      // the request instead of deleting it for the "no open request" case,
      // and reject the claim instead of deleting it for the "open, no
      // pending claim" case. Both are plain updates admin already has.
      const noRequest = await seedClaim(client, { admissionNo: "VC-DIR-NONE" });
      await client.query(
        "update payment_request set status = 'cancelled', closed_reason = 'cancelled' where id = $1",
        [noRequest.paymentRequestId],
      );
      await client.query(
        "update payment_claim set status = 'rejected', reject_reason = 'test cleanup', reviewed_by = $1, reviewed_at = now() where payment_request_id = $2",
        [ADMIN_ID, noRequest.paymentRequestId],
      );

      const openOnly = await seedClaim(client, { admissionNo: "VC-DIR-OPEN" });
      await client.query(
        "update payment_claim set status = 'rejected', reject_reason = 'test cleanup', reviewed_by = $1, reviewed_at = now() where id = $2",
        [ADMIN_ID, openOnly.claimId],
      );

      const reported = await seedClaim(client, { admissionNo: "VC-DIR-REPORTED" });

      const rows = await client.query<{ fee_accounts: unknown }>(
        `select fee_accounts from student_directory where id in ($1, $2, $3)`,
        [noRequest.studentId, openOnly.studentId, reported.studentId],
      );

      function statusFor(feeAccountId: string): string {
        for (const row of rows.rows) {
          const accounts = row.fee_accounts as { feeAccountId: string; paymentRequestStatus: string }[];
          const match = accounts.find((a) => a.feeAccountId === feeAccountId);
          if (match) return match.paymentRequestStatus;
        }
        throw new Error("fee account not found in student_directory");
      }

      expect(statusFor(noRequest.feeAccountId)).toBe("none");
      expect(statusFor(openOnly.feeAccountId)).toBe("open");
      expect(statusFor(reported.feeAccountId)).toBe("reported");
    });
  });
});
