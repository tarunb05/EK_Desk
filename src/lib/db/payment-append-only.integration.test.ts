import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, withRollback } from "./test-helpers";

describe("payment append-only guard", () => {
  let client: Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  async function insertFixturePayment(fixtureClient: Client) {
    const feeAccount = await fixtureClient.query<{ id: string }>(
      "select id from fee_account limit 1",
    );
    const payment = await fixtureClient.query<{ id: string }>(
      `insert into payment (fee_account_id, amount_paise, paid_on, method, recorded_by)
       values ($1, 10000, '2026-05-01', 'cash', 'front_office')
       returning id`,
      [feeAccount.rows[0].id],
    );
    return payment.rows[0].id;
  }

  it("rejects changing the amount of an existing payment", async () => {
    await withRollback(client, async () => {
      const paymentId = await insertFixturePayment(client);
      await expect(
        client.query("update payment set amount_paise = 99999 where id = $1", [
          paymentId,
        ]),
      ).rejects.toThrow();
    });
  });

  it("allows voiding a payment exactly once", async () => {
    await withRollback(client, async () => {
      const paymentId = await insertFixturePayment(client);
      await expect(
        client.query(
          "update payment set voided_at = now(), void_reason = 'test correction' where id = $1",
          [paymentId],
        ),
      ).resolves.toBeDefined();
    });
  });

  it("rejects voiding an already-voided payment", async () => {
    await withRollback(client, async () => {
      const paymentId = await insertFixturePayment(client);
      await client.query(
        "update payment set voided_at = now(), void_reason = 'first correction' where id = $1",
        [paymentId],
      );
      await expect(
        client.query(
          "update payment set voided_at = now(), void_reason = 'second correction' where id = $1",
          [paymentId],
        ),
      ).rejects.toThrow();
    });
  });
});
