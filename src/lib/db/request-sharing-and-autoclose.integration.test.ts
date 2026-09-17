import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonateAdmin, withRollback } from "./test-helpers";

describe("request sharing and auto-close (phase 15.3)", () => {
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

  // Builds student + fee_account + collection_account + one open
  // payment_request, as admin. Shared by most tests below.
  async function seedFixture(
    c: Client,
    overrides: { totalReceivablePaise?: number; requestAmountPaise?: number } = {},
  ) {
    await impersonateAdmin(c);

    const student = await c.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Autoclose Child', 'Guardian', '9000000401', 'Nursery-A')
       returning id`,
      [branchId, `AC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`],
    );
    const feeAccount = await c.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
       values ($1, $2, 'transport', $3, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
       returning id`,
      [student.rows[0]!.id, academicYearId, overrides.totalReceivablePaise ?? 1_000_000],
    );
    const collectionAccount = await c.query<{ id: string }>(
      `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
       values ($1, 'Autoclose Account', 'autoclose@upi', 'Payee',
               (select id from profile where role = 'admin' limit 1))
       returning id`,
      [branchId],
    );
    const request = await c.query<{ id: string }>(
      `insert into payment_request
         (fee_account_id, collection_account_id, reference_code, amount_paise,
          include_upi, include_bank, status, token_hash, expires_at, created_by)
       values ($1, $2, $3, $4, true, false, 'open', $5, now() + interval '7 days',
               (select id from profile where role = 'admin' limit 1))
       returning id`,
      [
        feeAccount.rows[0]!.id,
        collectionAccount.rows[0]!.id,
        `EK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        overrides.requestAmountPaise ?? 400_000,
        Buffer.from(Math.random().toString(36).slice(2, 10), "utf8"),
      ],
    );

    return {
      studentId: student.rows[0]!.id,
      feeAccountId: feeAccount.rows[0]!.id,
      collectionAccountId: collectionAccount.rows[0]!.id,
      paymentRequestId: request.rows[0]!.id,
    };
  }

  async function requestStatus(c: Client, id: string) {
    const result = await c.query<{ status: string; closed_reason: string | null }>(
      "select status, closed_reason from payment_request where id = $1",
      [id],
    );
    return result.rows[0]!;
  }

  it("a payment that clears pending closes the open request with pending_cleared", async () => {
    await withRollback(client, async () => {
      const fixture = await seedFixture(client, { totalReceivablePaise: 1_000_000 });

      await client.query(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 1000000, current_date, 'cash', 'admin')`,
        [fixture.feeAccountId],
      );

      const status = await requestStatus(client, fixture.paymentRequestId);
      expect(status.status).toBe("closed");
      expect(status.closed_reason).toBe("pending_cleared");
    });
  });

  it("a payment that doesn't clear pending leaves the request open", async () => {
    await withRollback(client, async () => {
      const fixture = await seedFixture(client, { totalReceivablePaise: 1_000_000 });

      await client.query(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
         values ($1, 100000, current_date, 'cash', 'admin')`,
        [fixture.feeAccountId],
      );

      const status = await requestStatus(client, fixture.paymentRequestId);
      expect(status.status).toBe("open");
    });
  });

  it("discontinuing a fee account cancels its open request with fee_account_changed", async () => {
    await withRollback(client, async () => {
      const fixture = await seedFixture(client);

      await client.query(
        "update fee_account set status = 'discontinued' where id = $1",
        [fixture.feeAccountId],
      );

      const status = await requestStatus(client, fixture.paymentRequestId);
      expect(status.status).toBe("cancelled");
      expect(status.closed_reason).toBe("fee_account_changed");
    });
  });

  it("lowering the receivable below the open request's amount cancels it with fee_account_changed", async () => {
    await withRollback(client, async () => {
      // Pending starts at 1,000,000; request is for 400,000.
      const fixture = await seedFixture(client, {
        totalReceivablePaise: 1_000_000,
        requestAmountPaise: 400_000,
      });

      // Lower receivable to 300,000 -- now less than the request's own amount.
      await client.query(
        "update fee_account set total_receivable_paise = 300000 where id = $1",
        [fixture.feeAccountId],
      );

      const status = await requestStatus(client, fixture.paymentRequestId);
      expect(status.status).toBe("cancelled");
      expect(status.closed_reason).toBe("fee_account_changed");
    });
  });

  it("raising the receivable does not touch an open request", async () => {
    await withRollback(client, async () => {
      const fixture = await seedFixture(client, {
        totalReceivablePaise: 1_000_000,
        requestAmountPaise: 400_000,
      });

      await client.query(
        "update fee_account set total_receivable_paise = 2000000 where id = $1",
        [fixture.feeAccountId],
      );

      const status = await requestStatus(client, fixture.paymentRequestId);
      expect(status.status).toBe("open");
    });
  });

  it("lowering the receivable but staying above the request's amount does not touch it", async () => {
    await withRollback(client, async () => {
      const fixture = await seedFixture(client, {
        totalReceivablePaise: 1_000_000,
        requestAmountPaise: 400_000,
      });

      // New pending (900,000) is still well above the request's 400,000.
      await client.query(
        "update fee_account set total_receivable_paise = 900000 where id = $1",
        [fixture.feeAccountId],
      );

      const status = await requestStatus(client, fixture.paymentRequestId);
      expect(status.status).toBe("open");
    });
  });

  it("create_payment_request cancels an existing open request before creating the new one", async () => {
    await withRollback(client, async () => {
      const fixture = await seedFixture(client, { totalReceivablePaise: 1_000_000 });

      const result = await client.query<{
        create_payment_request: { id: string; referenceCode: string };
      }>(
        `select create_payment_request(
           p_fee_account_id := $1, p_collection_account_id := $2,
           p_amount_paise := 500000, p_include_upi := true, p_include_bank := false,
           p_expiry_days := 7, p_token_hash := $3
         )`,
        [fixture.feeAccountId, fixture.collectionAccountId, Buffer.from("newtoken1", "utf8")],
      );
      const newId = result.rows[0]!.create_payment_request.id;
      expect(newId).not.toBe(fixture.paymentRequestId);

      const oldStatus = await requestStatus(client, fixture.paymentRequestId);
      expect(oldStatus.status).toBe("cancelled");
      expect(oldStatus.closed_reason).toBe("cancelled");

      const newStatus = await requestStatus(client, newId);
      expect(newStatus.status).toBe("open");
    });
  });

  it("create_payment_request rejects an amount above pending", async () => {
    await withRollback(client, async () => {
      await impersonateAdmin(client);
      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'AC-REJECT-1', 'Reject Child', 'Guardian', '9000000402', 'Nursery-A')
         returning id`,
        [branchId],
      );
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 100000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [student.rows[0]!.id, academicYearId],
      );
      const collectionAccount = await client.query<{ id: string }>(
        `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
         values ($1, 'Reject Account', 'reject@upi', 'Payee',
                 (select id from profile where role = 'admin' limit 1))
         returning id`,
        [branchId],
      );

      await expect(
        client.query(
          `select create_payment_request(
             p_fee_account_id := $1, p_collection_account_id := $2,
             p_amount_paise := 200000, p_include_upi := true, p_include_bank := false,
             p_expiry_days := 7, p_token_hash := $3
           )`,
          [feeAccount.rows[0]!.id, collectionAccount.rows[0]!.id, Buffer.from("rejecttoken", "utf8")],
        ),
      ).rejects.toThrow(/invalid amount/i);
    });
  });

  it("reissue_payment_request_token replaces the hash without changing anything else", async () => {
    await withRollback(client, async () => {
      const fixture = await seedFixture(client);

      const before = await client.query<{ token_hash: string; reference_code: string }>(
        "select token_hash, reference_code from payment_request where id = $1",
        [fixture.paymentRequestId],
      );

      await client.query("select reissue_payment_request_token($1, $2)", [
        fixture.paymentRequestId,
        Buffer.from("reissuedtoken", "utf8"),
      ]);

      const after = await client.query<{ token_hash: string; reference_code: string; status: string }>(
        "select token_hash, reference_code, status from payment_request where id = $1",
        [fixture.paymentRequestId],
      );
      expect(after.rows[0]!.token_hash).not.toBe(before.rows[0]!.token_hash);
      expect(after.rows[0]!.reference_code).toBe(before.rows[0]!.reference_code);
      expect(after.rows[0]!.status).toBe("open");
    });
  });

  it("two concurrent create_payment_request calls on the same fee account leave exactly one open", async () => {
    const clientA = await connect();
    const clientB = await connect();
    // Declared outside the try block so the finally block's cleanup can
    // find these rows even if an assertion throws partway through -- this
    // test commits real rows (a genuine two-connection race needs separate
    // transactions, which withRollback's shared one can't give).
    const label = `Race Autoclose ${Math.random().toString(36).slice(2, 8)}`;
    const admissionNo = `AC-RACE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    try {
      await clientA.query("begin");
      await impersonateAdmin(clientA);

      // A dedicated, non-current academic year rather than the shared
      // seeded one: this test commits real rows, and a sibling integration
      // test file (student-status.integration.test.ts) reads
      // dashboard_summary for the CURRENT year with no branch filter --
      // running concurrently in its own vitest worker, it can catch this
      // fee_account's receivable mid-flight if it shares that year. Same
      // fix as 15.1's own race test for the identical reason.
      const academicYear = await clientA.query<{ id: string }>(
        `insert into academic_year (label, starts_on, ends_on, is_current)
         values ('Race Test Year', '2020-04-01', '2021-03-31', false)
         on conflict (label) do update set label = excluded.label
         returning id`,
      );
      const raceYearId = academicYear.rows[0]!.id;

      const student = await clientA.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, $2, 'Race Child', 'Guardian', '9000000403', 'Nursery-A')
         returning id`,
        [branchId, admissionNo],
      );
      const feeAccount = await clientA.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2020-06-01', '2020-04-01', '2021-03-31', 'Route 1', 'Gate')
         returning id`,
        [student.rows[0]!.id, raceYearId],
      );
      const collectionAccount = await clientA.query<{ id: string }>(
        `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
         values ($1, $2, 'race@upi', 'Payee', (select id from profile where role = 'admin' limit 1))
         returning id`,
        [branchId, label],
      );
      await clientA.query("commit");

      const createSql = `
        select create_payment_request(
          p_fee_account_id := $1, p_collection_account_id := $2,
          p_amount_paise := 100000, p_include_upi := true, p_include_bank := false,
          p_expiry_days := 7, p_token_hash := $3
        )
      `;

      // reset role first: impersonateAdmin's own auth.users insert needs
      // the raw postgres role, and clientA's SET ROLE from the earlier
      // impersonateAdmin call (not transaction-scoped) is still in effect
      // after that transaction's commit.
      await clientA.query("reset role");
      await clientA.query("begin");
      await impersonateAdmin(clientA);
      await clientB.query("begin");
      await impersonateAdmin(clientB);

      await clientA.query(createSql, [
        feeAccount.rows[0]!.id,
        collectionAccount.rows[0]!.id,
        Buffer.from("racetokena", "utf8"),
      ]);
      // create_payment_request cancels-then-creates by design (the brief's
      // own "Create a new request cancels the old one first"), so unlike a
      // plain insert this genuinely has two correct outcomes depending on
      // exact timing: if clientB's own cancel-step runs before clientA
      // commits, clientB blocks on the insert itself and gets a clear
      // rejection once clientA commits; if it runs after, clientB's
      // cancel-step gracefully cancels clientA's just-committed request and
      // clientB's own create succeeds outright. Both are correct -- what
      // must always hold is that exactly one request ends up open, never
      // two and never zero, which is what this test actually checks rather
      // than assuming a specific one of the two outcomes.
      const clientBCreate = clientB
        .query(createSql, [
          feeAccount.rows[0]!.id,
          collectionAccount.rows[0]!.id,
          Buffer.from("racetokenb", "utf8"),
        ])
        .then(() => ({ ok: true as const }))
        .catch((e: Error) => ({ ok: false as const, message: e.message }));

      await clientA.query("commit");

      const bResult = await clientBCreate;
      if (!bResult.ok) {
        // The only acceptable failure is the fee-account-level conflict --
        // never the misleading "could not generate a unique reference
        // code" a real bug in the exception handler used to produce here
        // (it caught every unique_violation, including this one, and
        // retried with a new reference code that could never fix a
        // different constraint).
        expect(bResult.message).toMatch(
          /payment_request_one_open_per_fee_account/,
        );
      }
      await clientB.query("rollback").catch(() => {});

      await clientA.query("reset role");
      await clientA.query("begin");
      await impersonateAdmin(clientA);
      const openCount = await clientA.query<{ count: number }>(
        "select count(*)::int as count from payment_request where fee_account_id = $1 and status = 'open'",
        [feeAccount.rows[0]!.id],
      );
      expect(openCount.rows[0]!.count).toBe(1);
      await clientA.query("commit");
    } finally {
      for (const c of [clientA, clientB]) {
        try {
          await c.query("rollback");
        } catch {
          // No transaction was open.
        }
        await c.query("reset role");
      }
      // student first: cascades away fee_account and payment_request
      // (20260919000000/hard_delete_student's own cascade chain), which
      // must happen before collection_account can be deleted at all --
      // payment_request.collection_account_id has no cascade of its own.
      await clientA.query("delete from student where admission_no = $1", [
        admissionNo,
      ]);
      await clientA.query("delete from collection_account where label = $1", [
        label,
      ]);
      await clientA.end();
      await clientB.end();
    }
  });
});
