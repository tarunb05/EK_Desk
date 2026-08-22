import { describe, expect, it } from "vitest";
import { createAcademicYearSchema, createBranchSchema } from "./schemas";

describe("createAcademicYearSchema", () => {
  it("accepts a valid submission and defaults isCurrent to false when absent", () => {
    const result = createAcademicYearSchema.parse({
      label: "2027-2028",
      startsOn: "2027-04-01",
      endsOn: "2028-03-31",
    });
    expect(result.isCurrent).toBe(false);
  });

  it("transforms a checked checkbox's 'on' value to true", () => {
    const result = createAcademicYearSchema.parse({
      label: "2027-2028",
      startsOn: "2027-04-01",
      endsOn: "2028-03-31",
      isCurrent: "on",
    });
    expect(result.isCurrent).toBe(true);
  });

  it("rejects an end date on or before the start date", () => {
    const result = createAcademicYearSchema.safeParse({
      label: "2027-2028",
      startsOn: "2027-04-01",
      endsOn: "2027-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = createAcademicYearSchema.safeParse({
      label: "",
      startsOn: "2027-04-01",
      endsOn: "2028-03-31",
    });
    expect(result.success).toBe(false);
  });
});

describe("createBranchSchema", () => {
  it("accepts a valid submission", () => {
    const result = createBranchSchema.parse({
      code: "BR-C",
      name: "Whitefield",
    });
    expect(result).toEqual({ code: "BR-C", name: "Whitefield" });
  });

  it("rejects an empty code or name", () => {
    expect(
      createBranchSchema.safeParse({ code: "", name: "Whitefield" }).success,
    ).toBe(false);
    expect(
      createBranchSchema.safeParse({ code: "BR-C", name: "" }).success,
    ).toBe(false);
  });
});
