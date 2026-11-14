import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "./datetime";

describe("formatDisplayDate", () => {
  it("turns an ISO calendar date into day, short month, year", () => {
    expect(formatDisplayDate("2026-09-24")).toBe("24 Sep 2026");
    expect(formatDisplayDate("2027-01-05")).toBe("5 Jan 2027");
  });

  it("returns anything that is not a calendar date unchanged", () => {
    expect(formatDisplayDate("")).toBe("");
    expect(formatDisplayDate("2026-13-01")).toBe("2026-13-01");
    expect(formatDisplayDate("yesterday")).toBe("yesterday");
  });
});
