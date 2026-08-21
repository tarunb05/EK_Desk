import { describe, expect, it } from "vitest";
import { recordTableSearchParamsSchema } from "./table-params";

describe("recordTableSearchParamsSchema", () => {
  it("applies defaults when nothing is provided", () => {
    const result = recordTableSearchParamsSchema.parse({});
    expect(result).toEqual({
      page: 1,
      status: "all",
      classSection: undefined,
      q: undefined,
      sort: "full_name",
      dir: "asc",
    });
  });

  it("accepts valid values", () => {
    const result = recordTableSearchParamsSchema.parse({
      page: "3",
      status: "overdue",
      classSection: "Nursery-A",
      q: "sharma",
      sort: "pending_paise",
      dir: "desc",
    });
    expect(result).toEqual({
      page: 3,
      status: "overdue",
      classSection: "Nursery-A",
      q: "sharma",
      sort: "pending_paise",
      dir: "desc",
    });
  });

  it("falls back to defaults for an invalid status", () => {
    const result = recordTableSearchParamsSchema.parse({ status: "bogus" });
    expect(result.status).toBe("all");
  });

  it("falls back to defaults for an invalid sort key", () => {
    const result = recordTableSearchParamsSchema.parse({ sort: "bogus" });
    expect(result.sort).toBe("full_name");
  });

  it("falls back to page 1 for a non-numeric page", () => {
    const result = recordTableSearchParamsSchema.parse({
      page: "not-a-number",
    });
    expect(result.page).toBe(1);
  });

  it("falls back to page 1 for a negative page", () => {
    const result = recordTableSearchParamsSchema.parse({ page: "-5" });
    expect(result.page).toBe(1);
  });
});
