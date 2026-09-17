import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonateAdmin, withRollback } from "./test-helpers";

function hash(label: string): Buffer {
  return Buffer.from(`hash-${label}-${Math.random().toString(36).slice(2)}`, "utf8");
}

describe("pay page: lookup, rate limits, claims (phase 15.4)", () => {
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

  async function seedRequest(
    c: Client,
    overrides: { status?: string; admissionNo?: string; tokenHash?: Buffer } = {},
  ) {
    // reset role first: impersonateAdmin's own auth.users insert needs the
    // raw postgres role, and a *previous* call (this test's own, or an
    // explicit one before a loop of these) leaves the session as
    // 'authenticated' -- harmless no-op the very first time, when role is
    // already the session default.
    await c.query("reset role");
    await impersonateAdmin(c);

    const admissionNo =
      overrides.admissionNo ??
      `PP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const student = await c.query<{ id: string }>(
      `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
       values ($1, $2, 'Pay Page Child', 'Guardian', '9000000601', 'Nursery-A')
       returning id`,
      [branchId, admissionNo],
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
       values ($1, 'Pay Page Account', 'paypage@upi', 'Payee',
               (select id from profile where role = 'admin' limit 1))
       returning id`,
      [branchId],
    );
    const tokenHash = overrides.tokenHash ?? hash("token");
    const status = overrides.status ?? "open";
    const closedReason = status === "open" ? null : "cancelled";
    const request = await c.query<{ id: string }>(
      `insert into payment_request
         (fee_account_id, collection_account_id, reference_code, amount_paise,
          include_upi, include_bank, status, closed_reason, token_hash, expires_at, created_by)
       values ($1, $2, $3, 400000, true, false, $4, $6, $5, now() + interval '7 days',
               (select id from profile where role = 'admin' limit 1))
       returning id`,
      [
        feeAccount.rows[0]!.id,
        collectionAccount.rows[0]!.id,
        `EK-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        status,
        tokenHash,
        closedReason,
      ],
    );

    return {
      studentId: student.rows[0]!.id,
      feeAccountId: feeAccount.rows[0]!.id,
      paymentRequestId: request.rows[0]!.id,
      tokenHash,
    };
  }

  it("returns the open request's data for a valid token", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequest(client);
      await client.query("set role anon");

      const result = await client.query(
        "select * from lookup_payment_request_by_token_hash($1, $2)",
        [fixture.tokenHash, hash("ip")],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].status).toBe("open");
      expect(result.rows[0].child_first_name).toBe("Pay");
    });
  });

  it("returns nothing for an unknown token, and the real row (for the TS layer to collapse) for a cancelled one", async () => {
    await withRollback(client, async () => {
      // The SQL function deliberately does the same joins regardless of
      // status -- collapsing a non-open status to the generic response is
      // getPayPageData's job in TypeScript (actions.ts), not this
      // function's. So a cancelled request still comes back here, just
      // with status = 'cancelled' rather than 'open'; only a genuinely
      // unknown hash (or a rate-limited one) short-circuits to no rows.
      const cancelled = await seedRequest(client, {
        status: "cancelled",
        admissionNo: "PP-CANCELLED",
      });
      await client.query("set role anon");

      const unknown = await client.query(
        "select * from lookup_payment_request_by_token_hash($1, $2)",
        [hash("unknown-token"), hash("ip")],
      );
      const cancelledResult = await client.query(
        "select * from lookup_payment_request_by_token_hash($1, $2)",
        [cancelled.tokenHash, hash("ip")],
      );

      expect(unknown.rows).toHaveLength(0);
      expect(cancelledResult.rows).toHaveLength(1);
      expect(cancelledResult.rows[0].status).toBe("cancelled");
    });
  });

  it("blocks further lookups once the per-token view limit is exceeded", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequest(client);
      await client.query("set role anon");

      // The limit is 30/token per 10 minutes -- 30 successful views, then
      // the 31st (a different IP each time, so only the token limit can be
      // the one blocking it) should come back empty.
      for (let i = 0; i < 30; i++) {
        const result = await client.query(
          "select * from lookup_payment_request_by_token_hash($1, $2)",
          [fixture.tokenHash, hash(`ip-${i}`)],
        );
        expect(result.rows).toHaveLength(1);
      }

      const blocked = await client.query(
        "select * from lookup_payment_request_by_token_hash($1, $2)",
        [fixture.tokenHash, hash("ip-final")],
      );
      expect(blocked.rows).toHaveLength(0);
    });
  });

  it("blocks further lookups once the per-IP view limit is exceeded", async () => {
    await withRollback(client, async () => {
      const ip = hash("hammering-ip");
      await impersonateAdmin(client);
      // 60 different tokens (each its own request) from the same IP --
      // only the IP limit (60/10min) should be the one blocking the 61st,
      // since each token is only viewed once.
      const tokens: Buffer[] = [];
      for (let i = 0; i < 60; i++) {
        const fixture = await seedRequest(client, {
          admissionNo: `PP-IPLIMIT-${i}`,
        });
        tokens.push(fixture.tokenHash);
      }

      await client.query("set role anon");
      for (const tokenHash of tokens) {
        const result = await client.query(
          "select * from lookup_payment_request_by_token_hash($1, $2)",
          [tokenHash, ip],
        );
        expect(result.rows).toHaveLength(1);
      }

      const extraFixture = await (async () => {
        await client.query("reset role");
        const f = await seedRequest(client, { admissionNo: "PP-IPLIMIT-EXTRA" });
        await client.query("set role anon");
        return f;
      })();

      const blocked = await client.query(
        "select * from lookup_payment_request_by_token_hash($1, $2)",
        [extraFixture.tokenHash, ip],
      );
      expect(blocked.rows).toHaveLength(0);
    });
  });

  it("submit_payment_claim rejects a non-open request", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequest(client, {
        status: "closed",
        admissionNo: "PP-CLOSED-CLAIM",
      });
      await client.query("set role anon");

      await expect(
        client.query(
          `select submit_payment_claim($1, $2, 'UTR000000001', 400000, current_date, 'parent_page')`,
          [fixture.tokenHash, hash("ip")],
        ),
      ).rejects.toThrow(/not open/i);
    });
  });

  it("submit_payment_claim accepts a valid claim and logs the activity", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequest(client);
      await client.query("set role anon");

      await client.query(
        `select submit_payment_claim($1, $2, 'UTR000000002', 400000, current_date, 'parent_page')`,
        [fixture.tokenHash, hash("ip")],
      );

      await client.query("reset role");
      await impersonateAdmin(client);
      const claims = await client.query(
        "select utr, status from payment_claim where payment_request_id = $1",
        [fixture.paymentRequestId],
      );
      expect(claims.rows).toHaveLength(1);
      expect(claims.rows[0].utr).toBe("UTR000000002");
      expect(claims.rows[0].status).toBe("pending");

      // pay_page_activity has zero grants to authenticated/anon -- only the
      // security definer functions can touch it, so this has to read as
      // the raw postgres role, not the impersonated admin.
      await client.query("reset role");
      const activity = await client.query(
        "select event_type from pay_page_activity where token_hash = $1 and event_type = 'claim'",
        [fixture.tokenHash],
      );
      expect(activity.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("submit_payment_claim rejects a 4th pending claim on the same request", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequest(client);
      await client.query("set role anon");

      for (let i = 0; i < 3; i++) {
        await client.query(
          `select submit_payment_claim($1, $2, $3, 400000, current_date, 'parent_page')`,
          [fixture.tokenHash, hash(`ip-${i}`), `UTR00000010${i}`],
        );
      }

      await expect(
        client.query(
          `select submit_payment_claim($1, $2, 'UTR000000999', 400000, current_date, 'parent_page')`,
          [fixture.tokenHash, hash("ip-4")],
        ),
      ).rejects.toThrow(/too many pending claims/i);
    });
  });

  // The per-TOKEN claim rate limit (5/hour) isn't independently reachable
  // by an integration test today: it only counts *successful* submissions
  // (a rejected attempt never reaches the activity-log insert), and the
  // per-request pending-claims cap (3) is lower than it -- with no
  // confirm/reject flow yet (that's 15.5) to free up a pending slot, the
  // pending cap always trips first for a single token's own claims. The
  // per-IP limit doesn't have this problem, since it accumulates across
  // many different tokens/requests, each well under its own pending cap.
  it("submit_payment_claim rejects past the per-IP claim rate limit", async () => {
    await withRollback(client, async () => {
      const ip = hash("claim-hammering-ip");
      await impersonateAdmin(client);

      // 10 different requests, one accepted claim each (well under each
      // request's own pending cap of 3) -- only the shared IP accumulates
      // to the limit (10/hour).
      const fixtures = [];
      for (let i = 0; i < 10; i++) {
        fixtures.push(
          await seedRequest(client, { admissionNo: `PP-IPCLAIM-${i}` }),
        );
      }
      await client.query("set role anon");
      for (let i = 0; i < fixtures.length; i++) {
        await client.query(
          `select submit_payment_claim($1, $2, $3, 400000, current_date, 'parent_page')`,
          [fixtures[i]!.tokenHash, ip, `UTR0000003${String(i).padStart(2, "0")}`],
        );
      }

      await client.query("reset role");
      const extra = await seedRequest(client, { admissionNo: "PP-IPCLAIM-EXTRA" });
      await client.query("set role anon");

      await expect(
        client.query(
          `select submit_payment_claim($1, $2, 'UTR000000399', 400000, current_date, 'parent_page')`,
          [extra.tokenHash, ip],
        ),
      ).rejects.toThrow(/too many attempts/i);
    });
  });

  it("the anon role can call both functions but cannot select from the underlying tables", async () => {
    await withRollback(client, async () => {
      const fixture = await seedRequest(client);
      await client.query("set role anon");

      for (const table of [
        "payment_request",
        "payment_claim",
        "collection_account",
        "pay_page_activity",
      ]) {
        await client.query("savepoint before_denied_read");
        await expect(client.query(`select 1 from ${table}`)).rejects.toThrow();
        await client.query("rollback to savepoint before_denied_read");
      }

      const result = await client.query(
        "select * from lookup_payment_request_by_token_hash($1, $2)",
        [fixture.tokenHash, hash("ip")],
      );
      expect(result.rows).toHaveLength(1);
    });
  });
});
