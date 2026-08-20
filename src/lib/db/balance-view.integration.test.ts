import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateBalance } from "../domain/balance";
import type { Payment } from "../domain/types";
import { connect } from "./test-helpers";

describe("fee_account_balance view", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("agrees with the unit-tested balance maths for every seeded fee account", async () => {
    const accounts = await client.query<{
      id: string;
      total_receivable_paise: string;
    }>("select id, total_receivable_paise from fee_account");

    expect(accounts.rows.length).toBeGreaterThan(0);

    const payments = await client.query<{
      fee_account_id: string;
      amount_paise: string;
      paid_on: string;
      voided_at: string | null;
    }>(
      `select fee_account_id, amount_paise, paid_on::text, voided_at
       from payment`,
    );

    const paymentsByAccount = new Map<string, Payment[]>();
    for (const row of payments.rows) {
      const list = paymentsByAccount.get(row.fee_account_id) ?? [];
      list.push({
        amountPaise: BigInt(row.amount_paise),
        paidOn: new Date(row.paid_on),
        voidedAt: row.voided_at ? new Date(row.voided_at) : null,
      });
      paymentsByAccount.set(row.fee_account_id, list);
    }

    const viewRows = await client.query<{
      fee_account_id: string;
      collected_paise: string;
      pending_paise: string;
      last_paid_on: string | null;
    }>(
      `select fee_account_id, collected_paise, pending_paise, last_paid_on::text
       from fee_account_balance`,
    );
    const viewByAccount = new Map(
      viewRows.rows.map((row) => [row.fee_account_id, row]),
    );

    for (const account of accounts.rows) {
      const expected = calculateBalance(
        BigInt(account.total_receivable_paise),
        paymentsByAccount.get(account.id) ?? [],
      );
      const actual = viewByAccount.get(account.id);

      expect(actual).toBeDefined();
      expect(BigInt(actual!.collected_paise)).toBe(expected.collectedPaise);
      expect(BigInt(actual!.pending_paise)).toBe(expected.pendingPaise);
      expect(actual!.last_paid_on).toBe(
        expected.lastPaidOn
          ? expected.lastPaidOn.toISOString().slice(0, 10)
          : null,
      );
    }
  });
});
