import { describe, expect, it } from "vitest";
import {
  academicYearContaining,
  generateTwelveMonths,
  isWithinAcademicYear,
} from "./academic-year";
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

describe("generateTwelveMonths", () => {
  it("spans April of the start year through March of the next", () => {
    expect(generateTwelveMonths("2026-04-01")).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
    ]);
  });

  it("rolls the year over correctly starting from a non-April month", () => {
    expect(generateTwelveMonths("2026-11-01")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
    ]);
  });

  it("returns an empty array for a malformed date", () => {
    expect(generateTwelveMonths("not-a-date")).toEqual([]);
  });
});

describe("academicYearContaining", () => {
  const years = [
    { id: "y2627", startsOn: "2026-04-01", endsOn: "2027-03-31" },
    { id: "y2526", startsOn: "2025-04-01", endsOn: "2026-03-31" },
  ];

  it("finds the year a date falls in, including both end days", () => {
    expect(academicYearContaining("2026-11-11", years)?.id).toBe("y2627");
    expect(academicYearContaining("2026-04-01", years)?.id).toBe("y2627");
    expect(academicYearContaining("2026-03-31", years)?.id).toBe("y2526");
    expect(academicYearContaining("2027-03-31", years)?.id).toBe("y2627");
  });

  it("is null for a date outside every year", () => {
    expect(academicYearContaining("2027-04-01", years)).toBeNull();
    expect(academicYearContaining("2025-03-31", years)).toBeNull();
  });
});
