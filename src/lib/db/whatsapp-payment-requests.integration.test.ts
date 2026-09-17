import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, impersonateAdmin, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000101";
const TEACHER_ID = "00000000-0000-4000-8000-000000000102";

describe("whatsapp payment requests (phase 15.1)", () => {
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

  // Builds one full chain -- student, fee_account, collection_account,
  // payment_request -- as admin, and returns the ids the tests need.
  // Every payment_request in these tests goes through this so the shape
  // (branch/service/child name/amount/etc.) is consistent across tests.
  async function seedRequestFixture(
    c: Client,
    overrides: {
      tokenHash?: Buffer;
      status?: string;
      closedReason?: string | null;
      admissionNo?: string;
    } = {},
  ) {
    await seedProfiles(c);
    await impersonate(c, ADMIN_ID);

    const student = await c.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Lookup Test Child', 'Lookup Guardian', '9000000201', 'Nursery-A')
       returning id`,
      [branchId, overrides.admissionNo ?? "WA-LOOKUP-1"],
    );
    const feeAccount = await c.query<{ id: string }>(
      `insert into fee_account
         (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
       values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
       returning id`,
      [student.rows[0]!.id, academicYearId],
    );
    const collectionAccount = await c.query<{ id: string }>(
      `insert into collection_account
         (branch_id, label, upi_id, payee_name, updated_by)
       values ($1, 'Main', 'school@upi', 'EuroKids Kothanur', $2)
       returning id`,
      [branchId, ADMIN_ID],
    );
    const tokenHash = overrides.tokenHash ?? Buffer.from("deadbeef", "hex");
    const status = overrides.status ?? "open";
    const closedReason =
      overrides.closedReason !== undefined
        ? overrides.closedReason
        : status === "open"
          ? null
          : "cancelled";
    const paymentRequest = await c.query<{ id: string }>(
      `insert into payment_request
         (fee_account_id, collection_account_id, reference_code, amount_paise,
          include_upi, include_bank, status, closed_reason, token_hash, expires_at, created_by)
       values ($1, $2, $3, 400000, true, false, $4, $5, $6, now() + interval '7 days', $7)
       returning id`,
      [
        feeAccount.rows[0]!.id,
        collectionAccount.rows[0]!.id,
        `EK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        status,
        closedReason,
        tokenHash,
        ADMIN_ID,
      ],
    );

    return {
      studentId: student.rows[0]!.id,
      feeAccountId: feeAccount.rows[0]!.id,
      collectionAccountId: collectionAccount.rows[0]!.id,
      paymentRequestId: paymentRequest.rows[0]!.id,
      tokenHash,
    };
  }

  it("a teacher can't read collection_account, payment_request, payment_claim, or the change log", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequestFixture(client);
      await impersonate(client, TEACHER_ID);

      // Reading past RLS is a silent empty result, not an error -- these
      // aren't expected to throw, so no savepoint dance needed here.
      const accounts = await client.query("select 1 from collection_account");
      expect(accounts.rows).toHaveLength(0);

      const requests = await client.query("select 1 from payment_request");
      expect(requests.rows).toHaveLength(0);

      const claims = await client.query("select 1 from payment_claim");
      expect(claims.rows).toHaveLength(0);

      await impersonate(client, ADMIN_ID);
      await client.query(
        `insert into payment_claim
           (payment_request_id, source, utr, claimed_amount_paise, claimed_paid_on)
         values ($1, 'parent_page', 'UTR000000001', 400000, current_date)`,
        [fixture.paymentRequestId],
      );
      await impersonate(client, TEACHER_ID);
      const changeLog = await client.query(
        "select 1 from collection_account_change_log",
      );
      expect(changeLog.rows).toHaveLength(0);
    });
  });

  it("a teacher can't insert into collection_account or payment_request", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, TEACHER_ID);

      await expect(
        client.query(
          `insert into collection_account (branch_id, label, upi_id, payee_name, updated_by)
           values ($1, 'Denied', 'x@upi', 'X', $2)`,
          [branchId, TEACHER_ID],
        ),
      ).rejects.toThrow();
    });
  });

  it("the anon role can't read the four tables directly, but can call lookup_payment_request_by_token_hash", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequestFixture(client);

      await client.query("set role anon");

      // anon has no grant on these tables at all, so each of these raises a
      // real permission-denied error (unlike a teacher's empty-but-successful
      // read above) -- Postgres aborts the whole transaction after any
      // error, so each expected failure needs its own savepoint to keep
      // going, same pattern as submissions.integration.test.ts's
      // concurrent-double-approve test.
      await client.query("savepoint before_denied_read");
      await expect(
        client.query("select 1 from payment_request"),
      ).rejects.toThrow();
      await client.query("rollback to savepoint before_denied_read");

      await client.query("savepoint before_denied_read");
      await expect(
        client.query("select 1 from collection_account"),
      ).rejects.toThrow();
      await client.query("rollback to savepoint before_denied_read");

      await client.query("savepoint before_denied_read");
      await expect(
        client.query("select 1 from payment_claim"),
      ).rejects.toThrow();
      await client.query("rollback to savepoint before_denied_read");

      const result = await client.query(
        "select * from lookup_payment_request_by_token_hash($1)",
        [fixture.tokenHash],
      );
      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.branch_name).toBeTruthy();
      expect(row.service_type).toBe("transport");
      expect(row.child_first_name).toBe("Lookup");
      expect(row.amount_paise).toBe("400000");
      expect(row.reference_code).toMatch(/^EK-/);
      expect(row.payee_name).toBe("EuroKids Kothanur");
      expect(row.upi_id).toBe("school@upi");
      expect(row.status).toBe("open");

      // Only the whitelisted columns come back -- no admission number, no
      // guardian name, no phone, no surname anywhere in the row.
      expect(Object.keys(row)).not.toContain("student_admission_no");
      expect(Object.keys(row)).not.toContain("phone");
    });
  });

  it("the lookup function returns the identical shape for an unknown hash, an expired-but-open row, and a cancelled row", async () => {
    await withRollback(client, async () => {
      const unknownHash = Buffer.from("00000000", "hex");
      const cancelled = await seedRequestFixture(client, {
        tokenHash: Buffer.from("cafebabe", "hex"),
        status: "cancelled",
        closedReason: "cancelled",
        admissionNo: "WA-LOOKUP-2",
      });

      await client.query("set role anon");

      const unknownResult = await client.query(
        "select * from lookup_payment_request_by_token_hash($1)",
        [unknownHash],
      );
      expect(unknownResult.rows).toHaveLength(0);

      const cancelledResult = await client.query(
        "select * from lookup_payment_request_by_token_hash($1)",
        [cancelled.tokenHash],
      );
      expect(cancelledResult.rows).toHaveLength(1);
      expect(cancelledResult.rows[0].status).toBe("cancelled");

      // Same column shape (row description) for the unknown and the
      // cancelled case -- neither leaks a different set of fields the page
      // could use to tell "never existed" from "existed but is closed".
      expect(unknownResult.fields.map((f) => f.name)).toEqual(
        cancelledResult.fields.map((f) => f.name),
      );
    });
  });

  it("two concurrent inserts against the same fee_account_id leave exactly one open payment_request", async () => {
    const clientA = await connect();
    const clientB = await connect();
    try {
      await clientA.query("begin");
      await seedProfiles(clientA);
      await impersonate(clientA, ADMIN_ID);

      // A dedicated, non-current academic year rather than the shared
      // seeded one: this test commits real rows (see below), and every
      // other integration test file that reads a dashboard aggregate for
      // the CURRENT year runs concurrently in its own worker (vitest
      // parallelizes across files by default) -- sharing the current year
      // briefly added this test's fee_account to totals a sibling test's
      // own before/after snapshot could catch mid-flight. A year nothing
      // else queries can't leak into anything else's assertions.
      //
      // Upsert, not insert-then-delete: fee_account rows created under it
      // get logged to activity_log (CLAUDE.md rule 12), which has no
      // cascade from academic_year, so once any fee_account has ever
      // referenced this row it can never be cleanly deleted again -- same
      // reasoning as the ADMIN_ID/TEACHER_ID profiles below. Idempotent by
      // label, so repeat runs reuse the same permanent row.
      const academicYear = await clientA.query<{ id: string }>(
        `insert into academic_year (label, starts_on, ends_on, is_current)
         values ('Race Test Year', '2020-04-01', '2021-03-31', false)
         on conflict (label) do update set label = excluded.label
         returning id`,
      );
      const raceYearId = academicYear.rows[0]!.id;

      const student = await clientA.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'WA-RACE-1', 'Race Child', 'Guardian', '9000000202', 'Nursery-A')
         returning id`,
        [branchId],
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
         values ($1, 'Race', 'race@upi', 'Race Payee', $2)
         returning id`,
        [branchId, ADMIN_ID],
      );
      // Commit the fixtures so clientB (a separate transaction) can see the
      // referenced rows -- only the two competing inserts below are the
      // actual race under test.
      await clientA.query("commit");

      const insertSql = `
        insert into payment_request
          (fee_account_id, collection_account_id, reference_code, amount_paise,
           include_upi, include_bank, status, token_hash, expires_at, created_by)
        values ($1, $2, $3, 100000, true, false, 'open', $4, now() + interval '7 days', $5)
      `;

      await clientA.query("begin");
      await impersonate(clientA, ADMIN_ID);
      await clientB.query("begin");
      await impersonate(clientB, ADMIN_ID);

      await clientA.query(insertSql, [
        feeAccount.rows[0]!.id,
        collectionAccount.rows[0]!.id,
        "EK-RACEA",
        Buffer.from("aaaa0001", "hex"),
        ADMIN_ID,
      ]);

      // Fires before clientA commits -- blocks on the partial unique index
      // until clientA's transaction resolves, then either succeeds (if
      // clientA rolled back) or fails with a unique violation (if clientA
      // committed). This is what actually exercises the index under a race,
      // not just "a second insert after the first is visible".
      const clientBInsert = clientB.query(insertSql, [
        feeAccount.rows[0]!.id,
        collectionAccount.rows[0]!.id,
        "EK-RACEB",
        Buffer.from("bbbb0002", "hex"),
        ADMIN_ID,
      ]);

      await clientA.query("commit");

      await expect(clientBInsert).rejects.toThrow(/duplicate key|unique/i);
      await clientB.query("rollback");

      // set_config's third argument scopes the JWT claim to the transaction
      // that just committed -- a fresh transaction needs to re-impersonate
      // before it can see admin-only rows again.
      await clientA.query("begin");
      await impersonate(clientA, ADMIN_ID);
      const openCount = await clientA.query(
        "select count(*)::int as count from payment_request where fee_account_id = $1 and status = 'open'",
        [feeAccount.rows[0]!.id],
      );
      expect(openCount.rows[0]!.count).toBe(1);
      await clientA.query("commit");

      // Cleanup runs as the raw postgres role: admin-full-access tables in
      // this schema only ever grant select/insert/update to authenticated
      // (matching student_submission/payment_submission's own grants --
      // the app itself never issues a DELETE against these, cascades handle
      // removal), so a delete has to bypass RLS/grants entirely rather than
      // go through them.
      await clientA.query("reset role");
      await clientA.query("delete from payment_request where fee_account_id = $1", [
        feeAccount.rows[0]!.id,
      ]);
      await clientA.query("delete from collection_account where id = $1", [
        collectionAccount.rows[0]!.id,
      ]);
      await clientA.query("delete from fee_account where id = $1", [
        feeAccount.rows[0]!.id,
      ]);
      await clientA.query("delete from student where id = $1", [
        student.rows[0]!.id,
      ]);

      // 'Race Test Year' is left in place, same reasoning as the profile
      // rows below -- see the upsert comment above.

      // The ADMIN_ID/TEACHER_ID profile rows this test committed are left
      // in place deliberately, not cleaned up: activity_log.actor_id has no
      // cascade from profile (CLAUDE.md rule 12 -- the log must survive
      // even a deleted actor), and every delete above just logged one more
      // row under this actor, so a clean profile delete is never actually
      // possible once any of this ran. Same reasoning already applies to
      // test-helpers.ts's own ADMIN_TEST_ID: a well-known, idempotent
      // (on conflict do nothing) fixture meant to persist, not a per-test
      // row meant to be rolled back.
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  it("one default collection_account per branch is enforced under a race", async () => {
    const clientA = await connect();
    const clientB = await connect();
    try {
      await clientA.query("begin");
      await impersonateAdmin(clientA);
      await clientA.query("commit");

      const insertSql = `
        insert into collection_account (branch_id, label, upi_id, payee_name, is_default, updated_by)
        values ($1, $2, $3, 'Default Payee', true, (select id from profile where role = 'admin' limit 1))
      `;

      // Each connection needs its own admin identity re-established inside
      // its own transaction -- clientB never had one, and clientA's
      // set_config JWT claim reset when its first transaction committed
      // above. `reset role` first: impersonateAdmin's own auth.users insert
      // needs the raw postgres role, and clientA's SET ROLE from the first
      // impersonateAdmin call (not transaction-scoped) is still in effect.
      await clientA.query("reset role");
      await clientA.query("begin");
      await impersonateAdmin(clientA);
      await clientB.query("begin");
      await impersonateAdmin(clientB);

      await clientA.query(insertSql, [branchId, "Default A", "defaulta@upi"]);
      const clientBInsert = clientB.query(insertSql, [
        branchId,
        "Default B",
        "defaultb@upi",
      ]);

      await clientA.query("commit");

      await expect(clientBInsert).rejects.toThrow(/duplicate key|unique/i);
      await clientB.query("rollback");

      await clientA.query("reset role");
      await clientA.query("begin");
      await impersonateAdmin(clientA);
      const defaults = await clientA.query(
        "select count(*)::int as count from collection_account where branch_id = $1 and is_default",
        [branchId],
      );
      expect(defaults.rows[0]!.count).toBe(1);
      await clientA.query("commit");

      // Same as the payment_request race test above: collection_account
      // grants no DELETE to authenticated, so cleanup goes through the raw
      // postgres role instead of RLS.
      await clientA.query("reset role");
      await clientA.query(
        "delete from collection_account where branch_id = $1 and label = 'Default A'",
        [branchId],
      );
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  it("recordPayment's blank-reference fix: two blank-reference UPI payments both store NULL, not colliding empty strings", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'WA-REF-1', 'Ref Child', 'Guardian', '9000000203', 'Nursery-A')
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

      // Mirrors what recordPayment now inserts for a blank reference
      // (`value.reference || null`) -- both rows use NULL, which a
      // standard unique index never treats as colliding.
      await expect(
        client.query(
          `insert into payment (fee_account_id, amount_paise, paid_on, method, reference, recorded_by)
           values ($1, 100000, '2026-06-01', 'upi', null, 'admin'),
                  ($1, 200000, '2026-06-02', 'upi', null, 'admin')`,
          [feeAccount.rows[0]!.id],
        ),
      ).resolves.toBeTruthy();

      const rows = await client.query(
        "select reference from payment where fee_account_id = $1",
        [feeAccount.rows[0]!.id],
      );
      expect(rows.rows.every((r) => r.reference === null)).toBe(true);
    });
  });

  it("a second non-voided UPI payment with the same real reference is rejected", async () => {
    await withRollback(client, async () => {
      await seedProfiles(client);
      await impersonate(client, ADMIN_ID);

      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'WA-REF-2', 'Ref Child 2', 'Guardian', '9000000204', 'Nursery-A')
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

      await client.query(
        `insert into payment (fee_account_id, amount_paise, paid_on, method, reference, recorded_by)
         values ($1, 100000, '2026-06-01', 'upi', 'DUPLICATE-UTR', 'admin')`,
        [feeAccount.rows[0]!.id],
      );

      await expect(
        client.query(
          `insert into payment (fee_account_id, amount_paise, paid_on, method, reference, recorded_by)
           values ($1, 200000, '2026-06-02', 'upi', 'DUPLICATE-UTR', 'admin')`,
          [feeAccount.rows[0]!.id],
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
    });
  });
});
