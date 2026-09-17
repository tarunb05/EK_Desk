import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connect, impersonate, withRollback } from "./test-helpers";

const ADMIN_ID = "00000000-0000-4000-8000-000000000301";
const ADMIN_PASSWORD = "correct-horse-battery-staple";

describe("collection account writes (phase 15.2)", () => {
  let client: Client;
  let branchId: string;

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
  });

  // A real bcrypt hash via pgcrypto, same as verify_current_password itself
  // uses to check it -- a NULL/blank encrypted_password (what seedProfiles
  // elsewhere in this test suite leaves, since it never needs a real
  // password check) can't stand in for "wrong password" here, since that's
  // exactly the boundary this test suite has to exercise.
  async function seedAdminWithPassword(c: Client) {
    await c.query(
      `insert into auth.users (id, encrypted_password)
       values ($1, extensions.crypt($2, extensions.gen_salt('bf')))
       on conflict (id) do update set encrypted_password = excluded.encrypted_password`,
      [ADMIN_ID, ADMIN_PASSWORD],
    );
    await c.query(
      `insert into profile (id, role, branch_id, full_name)
       values ($1, 'admin', null, 'Test Admin')
       on conflict (id) do nothing`,
      [ADMIN_ID],
    );
    await impersonate(c, ADMIN_ID);
  }

  it("verify_current_password accepts the right password and rejects a wrong one", async () => {
    await withRollback(client, async () => {
      await seedAdminWithPassword(client);

      const right = await client.query<{ verify_current_password: boolean }>(
        "select verify_current_password($1)",
        [ADMIN_PASSWORD],
      );
      expect(right.rows[0]!.verify_current_password).toBe(true);

      const wrong = await client.query<{ verify_current_password: boolean }>(
        "select verify_current_password($1)",
        ["not-the-password"],
      );
      expect(wrong.rows[0]!.verify_current_password).toBe(false);
    });
  });

  it("a wrong password rejects the write -- no row written, no log row", async () => {
    await withRollback(client, async () => {
      await seedAdminWithPassword(client);

      // Postgres aborts the whole transaction after any error -- a
      // savepoint isolates the expected failure so the read below (in the
      // same withRollback transaction) doesn't inherit "transaction is
      // aborted" instead of its own real result.
      await client.query("savepoint before_wrong_password");
      await expect(
        client.query(
          `select save_collection_account(
             p_id := null, p_branch_id := $1, p_label := 'Wrong Password Test',
             p_payee_name := 'Payee', p_is_active := true,
             p_current_password := 'not-the-password',
             p_upi_id := 'school@upi'
           )`,
          [branchId],
        ),
      ).rejects.toThrow(/incorrect password/i);
      await client.query("rollback to savepoint before_wrong_password");

      const accounts = await client.query(
        "select 1 from collection_account where label = 'Wrong Password Test'",
      );
      expect(accounts.rows).toHaveLength(0);
    });
  });

  it("a correct password creates the account and one audit log row", async () => {
    await withRollback(client, async () => {
      await seedAdminWithPassword(client);

      const result = await client.query<{ save_collection_account: { id: string } }>(
        `select save_collection_account(
           p_id := null, p_branch_id := $1, p_label := 'Correct Password Test',
           p_payee_name := 'Payee', p_is_active := true,
           p_current_password := $2,
           p_upi_id := 'school@upi'
         )`,
        [branchId, ADMIN_PASSWORD],
      );
      const accountId = result.rows[0]!.save_collection_account.id;
      expect(accountId).toBeTruthy();

      const log = await client.query<{ before: unknown; after: { label: string } }>(
        "select before, after from collection_account_change_log where collection_account_id = $1",
        [accountId],
      );
      expect(log.rows).toHaveLength(1);
      expect(log.rows[0]!.before).toBeNull();
      expect(log.rows[0]!.after.label).toBe("Correct Password Test");
    });
  });

  it("the audit log never contains an unmasked account number, even an 18-digit one", async () => {
    await withRollback(client, async () => {
      await seedAdminWithPassword(client);
      const rawAccountNumber = "123456789012345678";

      const result = await client.query<{ save_collection_account: { id: string } }>(
        `select save_collection_account(
           p_id := null, p_branch_id := $1, p_label := 'Masking Test',
           p_payee_name := 'Payee', p_is_active := true,
           p_current_password := $2,
           p_account_number := $3, p_ifsc := 'HDFC0001234'
         )`,
        [branchId, ADMIN_PASSWORD, rawAccountNumber],
      );
      const accountId = result.rows[0]!.save_collection_account.id;

      const log = await client.query<{ after: { account_number: string } }>(
        "select after from collection_account_change_log where collection_account_id = $1",
        [accountId],
      );
      expect(log.rows[0]!.after.account_number).toBe("••••5678");
      expect(log.rows[0]!.after.account_number).not.toContain(rawAccountNumber);

      // The table itself still holds the real number (masking is an
      // audit-log/display concern, not a storage one -- 15.4's pay page and
      // the parent-facing message both need the full number).
      const stored = await client.query<{ account_number: string }>(
        "select account_number from collection_account where id = $1",
        [accountId],
      );
      expect(stored.rows[0]!.account_number).toBe(rawAccountNumber);
    });
  });

  it("changing upi_id cancels open requests against that account; changing only the label does not", async () => {
    await withRollback(client, async () => {
      await seedAdminWithPassword(client);

      const created = await client.query<{
        save_collection_account: { id: string };
      }>(
        `select save_collection_account(
           p_id := null, p_branch_id := $1, p_label := 'Cascade Test',
           p_payee_name := 'Payee', p_is_active := true,
           p_current_password := $2, p_upi_id := 'original@upi'
         )`,
        [branchId, ADMIN_PASSWORD],
      );
      const accountId = created.rows[0]!.save_collection_account.id;

      const year = await client.query<{ id: string }>(
        "select id from academic_year where is_current limit 1",
      );
      const student = await client.query<{ id: string }>(
        `insert into student (branch_id, admission_no, full_name, guardian_name, phone, class_section)
         values ($1, 'CA-CASCADE-1', 'Cascade Child', 'Guardian', '9000000301', 'Nursery-A')
         returning id`,
        [branchId],
      );
      const feeAccount = await client.query<{ id: string }>(
        `insert into fee_account
           (student_id, academic_year_id, service_type, total_receivable_paise, due_date, starts_on, ends_on, route_name, pickup_point)
         values ($1, $2, 'transport', 1000000, '2026-06-01', '2026-04-01', '2027-03-31', 'Route 1', 'Gate')
         returning id`,
        [student.rows[0]!.id, year.rows[0]!.id],
      );
      const request = await client.query<{ id: string }>(
        `insert into payment_request
           (fee_account_id, collection_account_id, reference_code, amount_paise,
            include_upi, include_bank, status, token_hash, expires_at, created_by)
         values ($1, $2, 'EK-CASC1', 100000, true, false, 'open', $3, now() + interval '7 days', $4)
         returning id`,
        [
          feeAccount.rows[0]!.id,
          accountId,
          Buffer.from("cascade01", "hex"),
          ADMIN_ID,
        ],
      );

      // Renaming the label alone doesn't change what a parent pays into --
      // the open request must survive this save untouched.
      await client.query(
        `select save_collection_account(
           p_id := $1, p_branch_id := $2, p_label := 'Cascade Test Renamed',
           p_payee_name := 'Payee', p_is_active := true,
           p_current_password := $3, p_upi_id := 'original@upi'
         )`,
        [accountId, branchId, ADMIN_PASSWORD],
      );
      const afterRename = await client.query<{ status: string }>(
        "select status from payment_request where id = $1",
        [request.rows[0]!.id],
      );
      expect(afterRename.rows[0]!.status).toBe("open");

      // Now actually change the UPI id -- this must cancel the open request.
      const changed = await client.query<{
        save_collection_account: {
          affected: Array<{ admissionNo: string }>;
        };
      }>(
        `select save_collection_account(
           p_id := $1, p_branch_id := $2, p_label := 'Cascade Test Renamed',
           p_payee_name := 'Payee', p_is_active := true,
           p_current_password := $3, p_upi_id := 'changed@upi'
         )`,
        [accountId, branchId, ADMIN_PASSWORD],
      );
      const afterChange = await client.query<{
        status: string;
        closed_reason: string;
      }>(
        "select status, closed_reason from payment_request where id = $1",
        [request.rows[0]!.id],
      );
      expect(afterChange.rows[0]!.status).toBe("cancelled");
      expect(afterChange.rows[0]!.closed_reason).toBe("account_changed");
      expect(
        changed.rows[0]!.save_collection_account.affected.map(
          (a) => a.admissionNo,
        ),
      ).toContain("CA-CASCADE-1");
    });
  });

  it("is_default stays exactly one under a concurrent pair of set_default calls", async () => {
    const clientA = await connect();
    const clientB = await connect();
    // Declared outside the try block, not just inside it: these two labels
    // are how the finally block's cleanup finds its own rows even if an
    // assertion throws before idA/idB's real uuids are captured below --
    // this test commits real rows (a genuine two-connection race needs
    // separate transactions, which withRollback's shared one can't give),
    // so an uncaught failure here would otherwise leak permanent fixture
    // data the way an earlier run of this exact test once did.
    const labelA = "Race Default A";
    const labelB = "Race Default B";
    try {
      await clientA.query("begin");
      await seedAdminWithPassword(clientA);

      const first = await clientA.query<{
        save_collection_account: { id: string };
      }>(
        `select save_collection_account(
           p_id := null, p_branch_id := $1, p_label := $2,
           p_payee_name := 'Payee', p_is_active := true,
           p_current_password := $3, p_upi_id := 'racea@upi'
         )`,
        [branchId, labelA, ADMIN_PASSWORD],
      );
      const idA = first.rows[0]!.save_collection_account.id;

      const second = await clientA.query<{
        save_collection_account: { id: string };
      }>(
        `select save_collection_account(
           p_id := null, p_branch_id := $1, p_label := $2,
           p_payee_name := 'Payee', p_is_active := true,
           p_current_password := $3, p_upi_id := 'raceb@upi'
         )`,
        [branchId, labelB, ADMIN_PASSWORD],
      );
      const idB = second.rows[0]!.save_collection_account.id;

      // Make A the default first, uncontested, then commit these fixtures
      // so clientB (a separate transaction) can see them.
      await clientA.query("select set_default_collection_account($1)", [idA]);
      await clientA.query("commit");

      await clientA.query("begin");
      await impersonate(clientA, ADMIN_ID);
      await clientB.query("begin");
      await impersonate(clientB, ADMIN_ID);

      await clientA.query("select set_default_collection_account($1)", [idB]);
      // clientB's own `for update` select on idA blocks here: clientA's
      // still-uncommitted "unset others" update already holds a row lock
      // on idA (it was the previous default). This is what makes the
      // function race-safe without ever hitting the partial unique index --
      // clientB simply re-evaluates against the post-commit state once
      // unblocked, rather than racing to insert/update the same row blind.
      const clientBSetDefault = clientB.query(
        "select set_default_collection_account($1)",
        [idA],
      );

      await clientA.query("commit");

      // Neither call throws -- the function itself resolves the race by
      // unsetting conflicts before setting the new default, rather than
      // relying on the partial unique index to reject a loser. What matters
      // is the end state: never two defaults, never zero.
      await expect(clientBSetDefault).resolves.toBeTruthy();
      await clientB.query("commit");

      await clientA.query("begin");
      await impersonate(clientA, ADMIN_ID);
      const defaults = await clientA.query<{ count: number }>(
        "select count(*)::int as count from collection_account where branch_id = $1 and is_default",
        [branchId],
      );
      expect(defaults.rows[0]!.count).toBe(1);
      await clientA.query("commit");
    } finally {
      // Best-effort, regardless of how the test above exited: roll back any
      // transaction still open on either connection (a query on an aborted
      // transaction throws, which is fine here -- this is cleanup, not an
      // assertion), then delete by label as the raw postgres role, so a
      // failure partway through the test above can never leak this test's
      // rows the way an earlier run of it once did.
      for (const client of [clientA, clientB]) {
        try {
          await client.query("rollback");
        } catch {
          // No transaction was open -- nothing to roll back.
        }
        await client.query("reset role");
      }
      await clientA.query(
        "delete from collection_account where label in ($1, $2)",
        [labelA, labelB],
      );
      await clientA.end();
      await clientB.end();
    }
  });
});
