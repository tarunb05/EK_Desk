import { describe, expect, it } from "vitest";
import { summarizeExpenseFilters } from "./expense-filter-summary";

describe("summarizeExpenseFilters", () => {
  it("is empty when nothing is filtered", () => {
    expect(summarizeExpenseFilters({})).toEqual([]);
    expect(summarizeExpenseFilters({ method: "all", q: "" })).toEqual([]);
  });

  it("names the month in full", () => {
    expect(summarizeExpenseFilters({ month: "2026-11" })).toEqual([
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
        month: "2026-11",
        categoryName: "Fuel",
        method: "upi",
        q: "diesel",
      }),
    ).toEqual(["November 2026", "Fuel", "UPI", "matching “diesel”"]);
  });

  it("ignores a malformed month", () => {
    expect(summarizeExpenseFilters({ month: "soon" })).toEqual([]);
  });
});
