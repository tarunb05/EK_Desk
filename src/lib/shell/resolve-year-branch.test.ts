import { describe, expect, it } from "vitest";
import { resolveYearAndBranch } from "./resolve-year-branch";

const years = [
  { id: "y2025", label: "2025-26", isCurrent: false, startsOn: "2025-04-01" },
  { id: "y2026", label: "2026-27", isCurrent: true, startsOn: "2026-04-01" },
];

const branches = [
  { id: "b1", code: "BR-A", name: "Branch A", isActive: true },
  { id: "b2", code: "BR-B", name: "Branch B", isActive: true },
];

describe("resolveYearAndBranch", () => {
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

  it("falls back to the first year when no year is marked current", () => {
    const noCurrentYears = [
      {
        id: "y2025",
        label: "2025-26",
        isCurrent: false,
        startsOn: "2025-04-01",
      },
      {
        id: "y2026",
        label: "2026-27",
        isCurrent: false,
        startsOn: "2026-04-01",
      },
    ];
    const result = resolveYearAndBranch({}, noCurrentYears, branches);
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
