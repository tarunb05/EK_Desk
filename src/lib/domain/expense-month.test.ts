import { describe, expect, it } from "vitest";
import {
  formatMonthLabel,
  isMonthKey,
  monthBounds,
  resolveExpenseDateRange,
} from "./expense-month";

describe("isMonthKey", () => {
  it("accepts YYYY-MM with a real month", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2027-01")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isMonthKey(undefined)).toBe(false);
    expect(isMonthKey("")).toBe(false);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey("November")).toBe(false);
  });
});

describe("formatMonthLabel", () => {
  it("spells the month and year out", () => {
    expect(formatMonthLabel("2026-11")).toBe("November 2026");
    expect(formatMonthLabel("2027-03")).toBe("March 2027");
  });
});

describe("monthBounds", () => {
  it("covers the first to the last day", () => {
    expect(monthBounds("2026-11")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(monthBounds("2026-12")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });

  it("handles February in a leap and a non-leap year", () => {
    expect(monthBounds("2027-02").to).toBe("2027-02-28");
    expect(monthBounds("2028-02").to).toBe("2028-02-29");
  });
});

describe("resolveExpenseDateRange", () => {
  it("is open-ended with no filters", () => {
    expect(resolveExpenseDateRange({})).toEqual({
      from: undefined,
      to: undefined,
    });
  });

  it("turns a month into its first and last day", () => {
    expect(resolveExpenseDateRange({ month: "2026-11" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("passes a custom range straight through", () => {
    expect(
      resolveExpenseDateRange({ from: "2026-10-05", to: "2026-10-20" }),
    ).toEqual({ from: "2026-10-05", to: "2026-10-20" });
  });

  it("intersects a month with a custom range", () => {
    expect(
      resolveExpenseDateRange({
        month: "2026-11",
        from: "2026-11-10",
        to: "2026-12-15",
      }),
    ).toEqual({ from: "2026-11-10", to: "2026-11-30" });
  });

  it("ignores a malformed month and empty strings", () => {
    expect(
      resolveExpenseDateRange({ month: "nonsense", from: "", to: "" }),
    ).toEqual({ from: undefined, to: undefined });
  });
});
