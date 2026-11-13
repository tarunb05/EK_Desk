import { describe, expect, it } from "vitest";
import { summarizeExpenseFilters } from "./expense-filter-summary";

describe("summarizeExpenseFilters", () => {
  it("is empty when nothing is filtered", () => {
    expect(summarizeExpenseFilters({})).toEqual([]);
    expect(summarizeExpenseFilters({ method: "all", q: "" })).toEqual([]);
  });

  it("names just the year when no month is chosen", () => {
    expect(summarizeExpenseFilters({ year: "2026" })).toEqual(["2026"]);
  });

  it("names the month and year together", () => {
    expect(summarizeExpenseFilters({ year: "2026", month: "11" })).toEqual([
      "November 2026",
    ]);
  });

  it("describes a custom range, open at either end or closed", () => {
    expect(
      summarizeExpenseFilters({ from: "2026-11-10", to: "2026-11-20" }),
    ).toEqual(["10 Nov 2026 – 20 Nov 2026"]);
    expect(summarizeExpenseFilters({ from: "2026-11-10" })).toEqual([
      "from 10 Nov 2026",
    ]);
    expect(summarizeExpenseFilters({ to: "2026-11-20" })).toEqual([
      "up to 20 Nov 2026",
    ]);
  });

  it("lists every active filter in a readable order", () => {
    expect(
      summarizeExpenseFilters({
        year: "2026",
        month: "11",
        categoryName: "Fuel",
        method: "upi",
        q: "diesel",
      }),
    ).toEqual(["November 2026", "Fuel", "UPI", "matching “diesel”"]);
  });

  it("ignores a malformed year or month", () => {
    expect(summarizeExpenseFilters({ year: "2026-27", month: "13" })).toEqual(
      [],
    );
  });
});
