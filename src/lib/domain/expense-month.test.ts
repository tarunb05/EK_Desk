import { describe, expect, it } from "vitest";
import {
  isMonth,
  isYear,
  monthName,
  periodBounds,
  resolveExpenseDateRange,
} from "./expense-month";

describe("isYear / isMonth", () => {
  it("accepts a four-digit year and a month number 1 to 12", () => {
    expect(isYear("2026")).toBe(true);
    expect(isMonth("1")).toBe(true);
    expect(isMonth("12")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isYear(undefined)).toBe(false);
    expect(isYear("2026-27")).toBe(false);
    expect(isYear("26")).toBe(false);
    expect(isMonth(undefined)).toBe(false);
    expect(isMonth("0")).toBe(false);
    expect(isMonth("13")).toBe(false);
    expect(isMonth("01")).toBe(false);
    expect(isMonth("November")).toBe(false);
  });
});

describe("monthName", () => {
  it("is the plain month name, with no year", () => {
    expect(monthName("1")).toBe("January");
    expect(monthName("11")).toBe("November");
    expect(monthName("12")).toBe("December");
  });
});

describe("periodBounds", () => {
  it("covers the whole calendar year with no month", () => {
    expect(periodBounds("2026")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("covers a month's first to last day", () => {
    expect(periodBounds("2026", "11")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(periodBounds("2026", "12").to).toBe("2026-12-31");
  });

  it("handles February in a leap and a non-leap year", () => {
    expect(periodBounds("2027", "2").to).toBe("2027-02-28");
    expect(periodBounds("2028", "2").to).toBe("2028-02-29");
  });
});

describe("resolveExpenseDateRange", () => {
  it("is open-ended with no filters", () => {
    expect(resolveExpenseDateRange({})).toEqual({
      from: undefined,
      to: undefined,
    });
  });

  it("turns a year into January to December", () => {
    expect(resolveExpenseDateRange({ year: "2026" })).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("narrows a year to a month", () => {
    expect(resolveExpenseDateRange({ year: "2026", month: "11" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("ignores a month with no year to put it in", () => {
    expect(resolveExpenseDateRange({ month: "11" })).toEqual({
      from: undefined,
      to: undefined,
    });
  });

  it("passes a custom range straight through when there is no year", () => {
    expect(
      resolveExpenseDateRange({ from: "2026-10-05", to: "2026-10-20" }),
    ).toEqual({ from: "2026-10-05", to: "2026-10-20" });
  });

  it("intersects a month with a custom range", () => {
    expect(
      resolveExpenseDateRange({
        year: "2026",
        month: "11",
        from: "2026-11-10",
        to: "2026-12-15",
      }),
    ).toEqual({ from: "2026-11-10", to: "2026-11-30" });
  });

  it("cuts a range that runs past the year at the year's edge", () => {
    expect(
      resolveExpenseDateRange({
        year: "2026",
        from: "2026-12-20",
        to: "2027-01-10",
      }),
    ).toEqual({ from: "2026-12-20", to: "2026-12-31" });
  });

  it("ignores malformed values and empty strings", () => {
    expect(
      resolveExpenseDateRange({
        year: "2026-27",
        month: "x",
        from: "",
        to: "",
      }),
    ).toEqual({ from: undefined, to: undefined });
  });
});
