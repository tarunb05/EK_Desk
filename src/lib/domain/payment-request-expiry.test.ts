import { describe, expect, it } from "vitest";
import { expiryDaysToExpiresAt } from "./payment-request-expiry";

describe("expiryDaysToExpiresAt", () => {
  const from = new Date("2026-06-01T00:00:00Z");

  it("adds 3 days", () => {
    expect(expiryDaysToExpiresAt(3, from).toISOString()).toBe(
      "2026-06-04T00:00:00.000Z",
    );
  });

  it("adds 7 days", () => {
    expect(expiryDaysToExpiresAt(7, from).toISOString()).toBe(
      "2026-06-08T00:00:00.000Z",
    );
  });

  it("adds 14 days", () => {
    expect(expiryDaysToExpiresAt(14, from).toISOString()).toBe(
      "2026-06-15T00:00:00.000Z",
    );
  });

  it("adds 30 days", () => {
    expect(expiryDaysToExpiresAt(30, from).toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });
});
