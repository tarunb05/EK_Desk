import { describe, expect, it } from "vitest";
import { collectionRate } from "./collection-rate";

describe("collectionRate", () => {
  it("computes a plain percentage of receivable collected", () => {
    expect(collectionRate(10_000n, 7_500n)).toBe(75);
  });

  it("is 100 when fully collected", () => {
    expect(collectionRate(10_000n, 10_000n)).toBe(100);
  });

  it("is 0 when nothing has been collected", () => {
    expect(collectionRate(10_000n, 0n)).toBe(0);
  });

  it("is 0 when receivable is zero, rather than NaN or Infinity", () => {
    expect(collectionRate(0n, 0n)).toBe(0);
  });

  it("can exceed 100 on overpayment, rather than clamping", () => {
    expect(collectionRate(10_000n, 15_000n)).toBe(150);
  });

  it("returns a precise fractional percentage", () => {
    expect(collectionRate(3n, 1n)).toBeCloseTo(33.333, 2);
  });
});
