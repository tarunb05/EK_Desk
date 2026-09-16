import { describe, expect, it } from "vitest";
import {
  expiryDaysToExpireBy,
  nextPaymentRequestStatus,
  validatePaymentLinkAmount,
  type PaymentRequestStatus,
} from "./payment-request";

const ALL_STATUSES: PaymentRequestStatus[] = [
  "open",
  "paid",
  "cancelled",
  "expired",
];

describe("nextPaymentRequestStatus", () => {
  it("moves an open request to paid on a paid event, unflagged", () => {
    expect(nextPaymentRequestStatus("open", "paid")).toEqual({
      nextStatus: "paid",
      flagged: false,
    });
  });

  it("moves an open request to cancelled on a cancelled event", () => {
    expect(nextPaymentRequestStatus("open", "cancelled")).toEqual({
      nextStatus: "cancelled",
      flagged: false,
    });
  });

  it("moves an open request to expired on an expired event", () => {
    expect(nextPaymentRequestStatus("open", "expired")).toEqual({
      nextStatus: "expired",
      flagged: false,
    });
  });

  it("still records a paid event after cancelled, and flags it", () => {
    expect(nextPaymentRequestStatus("cancelled", "paid")).toEqual({
      nextStatus: "paid",
      flagged: true,
    });
  });

  it("still records a paid event after expired, and flags it", () => {
    expect(nextPaymentRequestStatus("expired", "paid")).toEqual({
      nextStatus: "paid",
      flagged: true,
    });
  });

  it("a duplicate paid event on an already-paid request stays unflagged", () => {
    expect(nextPaymentRequestStatus("paid", "paid")).toEqual({
      nextStatus: "paid",
      flagged: false,
    });
  });

  it("never un-records a paid request on a cancelled event", () => {
    expect(nextPaymentRequestStatus("paid", "cancelled")).toEqual({
      nextStatus: "paid",
      flagged: false,
    });
  });

  it("never un-records a paid request on an expired event", () => {
    expect(nextPaymentRequestStatus("paid", "expired")).toEqual({
      nextStatus: "paid",
      flagged: false,
    });
  });

  it("a cancelled request stays cancelled on a duplicate cancelled event", () => {
    expect(nextPaymentRequestStatus("cancelled", "cancelled")).toEqual({
      nextStatus: "cancelled",
      flagged: false,
    });
  });

  it("a cancelled request stays cancelled on an expired event", () => {
    expect(nextPaymentRequestStatus("cancelled", "expired")).toEqual({
      nextStatus: "cancelled",
      flagged: false,
    });
  });

  it("an expired request stays expired on a duplicate expired event", () => {
    expect(nextPaymentRequestStatus("expired", "expired")).toEqual({
      nextStatus: "expired",
      flagged: false,
    });
  });

  it("an expired request stays expired on a cancelled event", () => {
    expect(nextPaymentRequestStatus("expired", "cancelled")).toEqual({
      nextStatus: "expired",
      flagged: false,
    });
  });

  it("covers every (status, event) pair without throwing", () => {
    for (const status of ALL_STATUSES) {
      for (const event of ["paid", "cancelled", "expired"] as const) {
        const result = nextPaymentRequestStatus(status, event);
        expect(ALL_STATUSES).toContain(result.nextStatus);
        expect(typeof result.flagged).toBe("boolean");
      }
    }
  });
});

describe("validatePaymentLinkAmount", () => {
  it("rejects zero", () => {
    expect(validatePaymentLinkAmount(0n, 10_000n).ok).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(validatePaymentLinkAmount(-500n, 10_000n).ok).toBe(false);
  });

  it("rejects an amount above pending", () => {
    expect(validatePaymentLinkAmount(10_001n, 10_000n).ok).toBe(false);
  });

  it("allows an amount equal to pending", () => {
    expect(validatePaymentLinkAmount(10_000n, 10_000n)).toEqual({ ok: true });
  });

  it("allows a part payment below pending", () => {
    expect(validatePaymentLinkAmount(5_000n, 10_000n)).toEqual({ ok: true });
  });
});

describe("expiryDaysToExpireBy", () => {
  const now = new Date("2026-09-16T10:00:00.000Z");

  it("adds the chosen number of days to now, in seconds", () => {
    const expected = Math.floor(
      (now.getTime() + 7 * 24 * 60 * 60 * 1000) / 1000,
    );
    expect(expiryDaysToExpireBy(7, now)).toBe(expected);
  });

  it("is always at least 15 minutes ahead, even for the shortest option", () => {
    const result = expiryDaysToExpireBy(1, now);
    const minimum = Math.floor((now.getTime() + 15 * 60 * 1000) / 1000);
    expect(result).toBeGreaterThanOrEqual(minimum);
  });
});
