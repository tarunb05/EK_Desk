import { describe, expect, it } from "vitest";
import { calculateBalance } from "./balance";
import { makePayment } from "./test-factories";

describe("calculateBalance", () => {
  it("treats an account with no payments as fully pending", () => {
    const result = calculateBalance(10_000n, []);
    expect(result.collectedPaise).toBe(0n);
    expect(result.pendingPaise).toBe(10_000n);
    expect(result.lastPaidOn).toBeNull();
  });

  it("collects a single full payment down to zero pending", () => {
    const payment = makePayment({ amountPaise: 10_000n });
    const result = calculateBalance(10_000n, [payment]);
    expect(result.collectedPaise).toBe(10_000n);
    expect(result.pendingPaise).toBe(0n);
    expect(result.lastPaidOn).toEqual(payment.paidOn);
  });

  it("sums multiple part payments", () => {
    const result = calculateBalance(10_000n, [
      makePayment({ amountPaise: 4_000n }),
      makePayment({ amountPaise: 3_000n }),
    ]);
    expect(result.collectedPaise).toBe(7_000n);
    expect(result.pendingPaise).toBe(3_000n);
  });

  it("excludes voided payments from collected and pending", () => {
    const result = calculateBalance(10_000n, [
      makePayment({ amountPaise: 10_000n, voidedAt: new Date() }),
    ]);
    expect(result.collectedPaise).toBe(0n);
    expect(result.pendingPaise).toBe(10_000n);
  });

  it("ignores a voided payment for lastPaidOn even when it is chronologically latest", () => {
    const earlierValid = makePayment({
      paidOn: new Date(Date.UTC(2026, 0, 10)),
    });
    const laterVoided = makePayment({
      paidOn: new Date(Date.UTC(2026, 0, 20)),
      voidedAt: new Date(Date.UTC(2026, 0, 21)),
    });
    const result = calculateBalance(10_000n, [earlierValid, laterVoided]);
    expect(result.lastPaidOn).toEqual(earlierValid.paidOn);
  });

  it("goes negative on overpayment rather than clamping at zero", () => {
    const result = calculateBalance(10_000n, [
      makePayment({ amountPaise: 15_000n }),
    ]);
    expect(result.pendingPaise).toBe(-5_000n);
  });

  it("handles a zero-amount payment without affecting the collected total", () => {
    const zeroPayment = makePayment({
      amountPaise: 0n,
      paidOn: new Date(Date.UTC(2026, 0, 25)),
    });
    const result = calculateBalance(10_000n, [zeroPayment]);
    expect(result.collectedPaise).toBe(0n);
    expect(result.pendingPaise).toBe(10_000n);
    expect(result.lastPaidOn).toEqual(zeroPayment.paidOn);
  });

  it("goes negative on a discontinued account with zero receivable but a recorded payment", () => {
    const result = calculateBalance(0n, [makePayment({ amountPaise: 5_000n })]);
    expect(result.pendingPaise).toBe(-5_000n);
  });
});
