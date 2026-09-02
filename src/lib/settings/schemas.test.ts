import { describe, expect, it } from "vitest";
import {
  createAcademicYearSchema,
  createBranchSchema,
  updateAcademicYearSchema,
  updateBranchSchema,
} from "./schemas";

const YEAR_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_ID = "22222222-2222-4222-8222-222222222222";

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

describe("updateAcademicYearSchema", () => {
  it("accepts a valid submission and defaults isCurrent to false when absent", () => {
    const result = updateAcademicYearSchema.parse({
      yearId: YEAR_ID,
      label: "2027-2028",
      startsOn: "2027-04-01",
      endsOn: "2028-03-31",
    });
    expect(result.isCurrent).toBe(false);
  });

  it("transforms a checked checkbox's 'on' value to true", () => {
    const result = updateAcademicYearSchema.parse({
      yearId: YEAR_ID,
      label: "2027-2028",
      startsOn: "2027-04-01",
      endsOn: "2028-03-31",
      isCurrent: "on",
    });
    expect(result.isCurrent).toBe(true);
  });

  it("rejects an end date on or before the start date", () => {
    const result = updateAcademicYearSchema.safeParse({
      yearId: YEAR_ID,
      label: "2027-2028",
      startsOn: "2027-04-01",
      endsOn: "2027-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid yearId", () => {
    const result = updateAcademicYearSchema.safeParse({
      yearId: "not-a-uuid",
      label: "2027-2028",
      startsOn: "2027-04-01",
      endsOn: "2028-03-31",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateBranchSchema", () => {
  it("accepts a valid submission and defaults isActive to false when absent", () => {
    const result = updateBranchSchema.parse({
      branchId: BRANCH_ID,
      code: "BR-C",
      name: "Whitefield",
    });
    expect(result.isActive).toBe(false);
  });

  it("transforms a checked checkbox's 'on' value to true", () => {
    const result = updateBranchSchema.parse({
      branchId: BRANCH_ID,
      code: "BR-C",
      name: "Whitefield",
      isActive: "on",
    });
    expect(result.isActive).toBe(true);
  });

  it("rejects an empty code or name", () => {
    expect(
      updateBranchSchema.safeParse({
        branchId: BRANCH_ID,
        code: "",
        name: "Whitefield",
      }).success,
    ).toBe(false);
    expect(
      updateBranchSchema.safeParse({
        branchId: BRANCH_ID,
        code: "BR-C",
        name: "",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-uuid branchId", () => {
    const result = updateBranchSchema.safeParse({
      branchId: "not-a-uuid",
      code: "BR-C",
      name: "Whitefield",
    });
    expect(result.success).toBe(false);
  });
});
