import { describe, expect, it } from "vitest";
import {
  closePaymentRequest,
  isPaymentRequestExpired,
  reviewPaymentClaim,
  type PaymentRequestCloseReason,
} from "./payment-request-state";

describe("closePaymentRequest", () => {
  const closingReasons: PaymentRequestCloseReason[] = [
    "paid",
    "pending_cleared",
    "expired",
  ];
  for (const reason of closingReasons) {
    it(`moves an open request to closed for reason "${reason}"`, () => {
      const result = closePaymentRequest("open", reason);
      expect(result).toEqual({
        nextStatus: "closed",
        closedReason: reason,
        changed: true,
      });
    });
  }

  const cancellingReasons: PaymentRequestCloseReason[] = [
    "cancelled",
    "account_changed",
    "fee_account_changed",
  ];
  for (const reason of cancellingReasons) {
    it(`moves an open request to cancelled for reason "${reason}"`, () => {
      const result = closePaymentRequest("open", reason);
      expect(result).toEqual({
        nextStatus: "cancelled",
        closedReason: reason,
        changed: true,
      });
    });
  }

  it("is a no-op on an already-closed request (money still arrived, allowed by the brief)", () => {
    const result = closePaymentRequest("closed", "paid");
    expect(result).toEqual({
      nextStatus: "closed",
      closedReason: null,
      changed: false,
    });
  });

  it("is a no-op on an already-cancelled request", () => {
    const result = closePaymentRequest("cancelled", "paid");
    expect(result).toEqual({
      nextStatus: "cancelled",
      closedReason: null,
      changed: false,
    });
  });
});

describe("reviewPaymentClaim", () => {
  it("confirms a pending claim", () => {
    expect(reviewPaymentClaim("pending", "confirmed")).toEqual({
      nextStatus: "confirmed",
      changed: true,
    });
  });

  it("rejects a pending claim", () => {
    expect(reviewPaymentClaim("pending", "rejected")).toEqual({
      nextStatus: "rejected",
      changed: true,
    });
  });

  it("is a no-op reviewing an already-confirmed claim", () => {
    expect(reviewPaymentClaim("confirmed", "rejected")).toEqual({
      nextStatus: "confirmed",
      changed: false,
    });
  });

  it("is a no-op reviewing an already-rejected claim", () => {
    expect(reviewPaymentClaim("rejected", "confirmed")).toEqual({
      nextStatus: "rejected",
      changed: false,
    });
  });
});

describe("isPaymentRequestExpired", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("is expired when open and past expires_at", () => {
    expect(
      isPaymentRequestExpired("open", new Date("2026-06-14T00:00:00Z"), now),
    ).toBe(true);
  });

  it("is not expired when open and before expires_at", () => {
    expect(
      isPaymentRequestExpired("open", new Date("2026-06-16T00:00:00Z"), now),
    ).toBe(false);
  });

  it("is not expired at the exact boundary instant", () => {
    expect(isPaymentRequestExpired("open", now, now)).toBe(false);
  });

  it("is never expired once closed, even past expires_at", () => {
    expect(
      isPaymentRequestExpired("closed", new Date("2026-06-01T00:00:00Z"), now),
    ).toBe(false);
  });

  it("is never expired once cancelled, even past expires_at", () => {
    expect(
      isPaymentRequestExpired(
        "cancelled",
        new Date("2026-06-01T00:00:00Z"),
        now,
      ),
    ).toBe(false);
  });
});
