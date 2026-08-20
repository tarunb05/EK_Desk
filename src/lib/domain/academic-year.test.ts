import { describe, expect, it } from "vitest";
import { isWithinAcademicYear } from "./academic-year";
import { makeAcademicYear } from "./test-factories";

describe("isWithinAcademicYear", () => {
  const year = makeAcademicYear({
    startsOn: new Date(Date.UTC(2026, 3, 1)),
    endsOn: new Date(Date.UTC(2027, 2, 31)),
  });

  it("includes the start date", () => {
    expect(isWithinAcademicYear(year.startsOn, year)).toBe(true);
  });

  it("includes the end date", () => {
    expect(isWithinAcademicYear(year.endsOn, year)).toBe(true);
  });

  it("includes a date in the middle of the year", () => {
    expect(isWithinAcademicYear(new Date(Date.UTC(2026, 8, 15)), year)).toBe(
      true,
    );
  });

  it("excludes a date before the year starts", () => {
    expect(isWithinAcademicYear(new Date(Date.UTC(2026, 2, 31)), year)).toBe(
      false,
    );
  });

  it("excludes a date after the year ends", () => {
    expect(isWithinAcademicYear(new Date(Date.UTC(2027, 3, 1)), year)).toBe(
      false,
    );
  });
});
