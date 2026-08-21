import { describe, expect, it } from "vitest";
import { studentDirectorySearchParamsSchema } from "./student-table-params";

describe("studentDirectorySearchParamsSchema", () => {
  it("applies defaults when nothing is provided", () => {
    const result = studentDirectorySearchParamsSchema.parse({});
    expect(result).toEqual({
      page: 1,
      status: "active",
      service: "all",
      classSection: undefined,
      q: undefined,
      sort: "created_at",
      dir: "desc",
    });
  });

  it("accepts valid values", () => {
    const result = studentDirectorySearchParamsSchema.parse({
      page: "2",
      status: "overdue",
      service: "transport",
      classSection: "Nursery-A",
      q: "sharma",
      sort: "full_name",
      dir: "asc",
    });
    expect(result).toEqual({
      page: 2,
      status: "overdue",
      service: "transport",
      classSection: "Nursery-A",
      q: "sharma",
      sort: "full_name",
      dir: "asc",
    });
  });

  it("falls back to defaults for an invalid status", () => {
    const result = studentDirectorySearchParamsSchema.parse({
      status: "bogus",
    });
    expect(result.status).toBe("active");
  });

  it("falls back to defaults for an invalid service", () => {
    const result = studentDirectorySearchParamsSchema.parse({
      service: "bogus",
    });
    expect(result.service).toBe("all");
  });

  it("falls back to defaults for an invalid sort key", () => {
    const result = studentDirectorySearchParamsSchema.parse({
      sort: "bogus",
    });
    expect(result.sort).toBe("created_at");
  });

  it("falls back to page 1 for a non-numeric page", () => {
    const result = studentDirectorySearchParamsSchema.parse({
      page: "not-a-number",
    });
    expect(result.page).toBe(1);
  });
});
