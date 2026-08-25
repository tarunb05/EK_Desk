import { describe, expect, it } from "vitest";
import { expenseTableSearchParamsSchema } from "./expense-table-params";

describe("expenseTableSearchParamsSchema", () => {
  it("applies defaults when nothing is provided", () => {
    const result = expenseTableSearchParamsSchema.parse({});
    expect(result).toEqual({
      page: 1,
      category: undefined,
      method: "all",
      from: undefined,
      to: undefined,
      q: undefined,
      sort: "spent_on",
      dir: "desc",
    });
  });

  it("accepts valid values", () => {
    const result = expenseTableSearchParamsSchema.parse({
      page: "2",
      category: "some-uuid",
      method: "upi",
      from: "2026-04-01",
      to: "2026-08-31",
      q: "grocery",
      sort: "amount_paise",
      dir: "asc",
    });
    expect(result).toEqual({
      page: 2,
      category: "some-uuid",
      method: "upi",
      from: "2026-04-01",
      to: "2026-08-31",
      q: "grocery",
      sort: "amount_paise",
      dir: "asc",
    });
  });

  it("falls back to defaults for an invalid method", () => {
    const result = expenseTableSearchParamsSchema.parse({ method: "bogus" });
    expect(result.method).toBe("all");
  });

  it("falls back to defaults for an invalid sort key", () => {
    const result = expenseTableSearchParamsSchema.parse({ sort: "bogus" });
    expect(result.sort).toBe("spent_on");
  });

  it("falls back to page 1 for a non-numeric page", () => {
    const result = expenseTableSearchParamsSchema.parse({
      page: "not-a-number",
    });
    expect(result.page).toBe(1);
  });
});
