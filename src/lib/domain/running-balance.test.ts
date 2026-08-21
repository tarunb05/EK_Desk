import { describe, expect, it } from "vitest";
import { computeRunningBalances } from "./running-balance";
import { makePayment } from "./test-factories";

describe("computeRunningBalances", () => {
  it("reduces pending balance after each payment, in chronological order", () => {
    const result = computeRunningBalances(10_000n, [
      makePayment({
        amountPaise: 3_000n,
        paidOn: new Date(Date.UTC(2026, 0, 20)),
      }),
      makePayment({
        amountPaise: 2_000n,
        paidOn: new Date(Date.UTC(2026, 0, 10)),
      }),
    ]);

    // sorted chronologically: Jan 10 first, then Jan 20
    expect(result[0]!.payment.paidOn).toEqual(new Date(Date.UTC(2026, 0, 10)));
    expect(result[0]!.runningPendingPaise).toBe(8_000n);
    expect(result[1]!.runningPendingPaise).toBe(5_000n);
  });

  it("gives a voided payment a null running balance and skips it in the running total", () => {
    const result = computeRunningBalances(10_000n, [
      makePayment({
        amountPaise: 3_000n,
        paidOn: new Date(Date.UTC(2026, 0, 10)),
        voidedAt: new Date(Date.UTC(2026, 0, 11)),
      }),
      makePayment({
        amountPaise: 2_000n,
        paidOn: new Date(Date.UTC(2026, 0, 20)),
      }),
    ]);

    expect(result[0]!.runningPendingPaise).toBeNull();
    expect(result[1]!.runningPendingPaise).toBe(8_000n);
  });

  it("returns an empty list for no payments", () => {
    expect(computeRunningBalances(10_000n, [])).toEqual([]);
  });
});
