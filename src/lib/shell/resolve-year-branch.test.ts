import { describe, expect, it } from "vitest";
import { resolveYearAndBranch } from "./resolve-year-branch";

const years = [
  {
    id: "y2025",
    label: "2025-26",
    isCurrent: false,
    startsOn: "2025-04-01",
    endsOn: "2026-03-31",
  },
  {
    id: "y2026",
    label: "2026-27",
    isCurrent: true,
    startsOn: "2026-04-01",
    endsOn: "2027-03-31",
  },
];

const branches = [
  { id: "b1", code: "BR-A", name: "Branch A", isActive: true },
  { id: "b2", code: "BR-B", name: "Branch B", isActive: true },
];

describe("resolveYearAndBranch", () => {
  // The nightly job that moves the "current" flag has not run yet on the
  // morning of 1 April: the flag still says 2026-27, but a 2027-28 row
  // exists and today is inside it.
  it("defaults to the year containing today even before the current flag has moved", () => {
    const withNextYear = [
      ...years,
      {
        id: "y2027",
        label: "2027-28",
        isCurrent: false,
        startsOn: "2027-04-01",
        endsOn: "2028-03-31",
      },
    ];
    expect(
      resolveYearAndBranch({}, withNextYear, branches, "2027-03-31").year.label,
    ).toBe("2026-27");
    expect(
      resolveYearAndBranch({}, withNextYear, branches, "2027-04-01").year.label,
    ).toBe("2027-28");
  });

  it("falls back to the flagged year when today is in no year on file", () => {
    expect(
      resolveYearAndBranch({}, years, branches, "2030-06-15").year.label,
    ).toBe("2026-27");
  });

  it("still honours a year named in the URL over today", () => {
    expect(
      resolveYearAndBranch({ year: "2025-26" }, years, branches, "2026-11-14")
        .year.label,
    ).toBe("2025-26");
  });

  it("selects the year matching a valid year param", () => {
    const result = resolveYearAndBranch({ year: "2025-26" }, years, branches);
    expect(result.year.label).toBe("2025-26");
  });

  it("falls back to the current year when the year param is missing", () => {
    const result = resolveYearAndBranch({}, years, branches);
    expect(result.year.label).toBe("2026-27");
  });

  it("falls back to the current year when the year param does not match any year", () => {
    const result = resolveYearAndBranch({ year: "1999-00" }, years, branches);
    expect(result.year.label).toBe("2026-27");
  });

  it("falls back to the first year when no year is marked current or contains today", () => {
    const noCurrentYears = [
      {
        id: "y2025",
        label: "2025-26",
        isCurrent: false,
        startsOn: "2025-04-01",
        endsOn: "2026-03-31",
      },
      {
        id: "y2026",
        label: "2026-27",
        isCurrent: false,
        startsOn: "2026-04-01",
        endsOn: "2027-03-31",
      },
    ];
    const result = resolveYearAndBranch(
      {},
      noCurrentYears,
      branches,
      // A date outside both years: with no year containing today and none
      // flagged, the first in the list is all that is left to pick.
      "2030-06-15",
    );
    expect(result.year.label).toBe("2025-26");
  });

  it("selects the branch matching a valid branch code", () => {
    const result = resolveYearAndBranch({ branch: "BR-B" }, years, branches);
    expect(result.branch).toBe("BR-B");
  });

  it("keeps 'all' when the branch param is 'all'", () => {
    const result = resolveYearAndBranch({ branch: "all" }, years, branches);
    expect(result.branch).toBe("all");
  });

  it("falls back to 'all' when the branch param is missing", () => {
    const result = resolveYearAndBranch({}, years, branches);
    expect(result.branch).toBe("all");
  });

  it("falls back to 'all' when the branch param does not match any branch", () => {
    const result = resolveYearAndBranch({ branch: "BR-Z" }, years, branches);
    expect(result.branch).toBe("all");
  });

  it("throws when there are no academic years to choose from", () => {
    expect(() => resolveYearAndBranch({}, [], branches)).toThrow();
  });
});
