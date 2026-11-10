import { describe, expect, it } from "vitest";
import { enrollmentEndsOn, enrollmentsOverlap } from "./enrollment-period";

const YEAR_END = "2027-03-31";

describe("enrollmentEndsOn", () => {
  it("ends a weekly enrollment six days later (seven days inclusive)", () => {
    expect(enrollmentEndsOn("2026-11-10", "weekly", YEAR_END)).toBe(
      "2026-11-16",
    );
  });

  it("crosses a month boundary for a weekly enrollment", () => {
    expect(enrollmentEndsOn("2026-11-28", "weekly", YEAR_END)).toBe(
      "2026-12-04",
    );
  });

  it("ends a monthly enrollment the day before the same date next month", () => {
    expect(enrollmentEndsOn("2026-11-10", "monthly", YEAR_END)).toBe(
      "2026-12-09",
    );
  });

  it("crosses a year boundary for a monthly enrollment", () => {
    expect(enrollmentEndsOn("2026-12-15", "monthly", YEAR_END)).toBe(
      "2027-01-14",
    );
  });

  it("clamps a month starting on the 31st to the shorter next month", () => {
    expect(enrollmentEndsOn("2027-01-31", "monthly", YEAR_END)).toBe(
      "2027-02-27",
    );
  });

  it("ends a monthly enrollment starting on the 1st on that month's last day", () => {
    expect(enrollmentEndsOn("2027-02-01", "monthly", YEAR_END)).toBe(
      "2027-02-28",
    );
  });

  it("ends a yearly enrollment on the academic year's last day", () => {
    expect(enrollmentEndsOn("2026-11-10", "yearly", YEAR_END)).toBe(YEAR_END);
  });

  it("falls back to a calendar year when starting after the academic year ends", () => {
    expect(enrollmentEndsOn("2027-04-05", "yearly", YEAR_END)).toBe(
      "2028-04-04",
    );
  });
});

describe("enrollmentsOverlap", () => {
  const nov = { startsOn: "2026-11-01", endsOn: "2026-11-30" };

  it("treats back-to-back enrollments as not overlapping", () => {
    expect(
      enrollmentsOverlap(nov, { startsOn: "2026-12-01", endsOn: "2026-12-31" }),
    ).toBe(false);
  });

  it("treats a shared last/first day as overlapping", () => {
    expect(
      enrollmentsOverlap(nov, { startsOn: "2026-11-30", endsOn: "2026-12-06" }),
    ).toBe(true);
  });

  it("treats one enrollment inside another as overlapping", () => {
    expect(
      enrollmentsOverlap(nov, { startsOn: "2026-11-10", endsOn: "2026-11-16" }),
    ).toBe(true);
  });
});
