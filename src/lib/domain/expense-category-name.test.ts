import { describe, expect, it } from "vitest";
import { normalizeCategoryName } from "./expense-category-name";

describe("normalizeCategoryName", () => {
  it("leaves an already-clean name unchanged", () => {
    expect(normalizeCategoryName("Grocery")).toBe("Grocery");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeCategoryName("  Grocery  ")).toBe("Grocery");
  });

  it("collapses multiple internal spaces to one", () => {
    expect(normalizeCategoryName("Vehicle    maintenance")).toBe(
      "Vehicle maintenance",
    );
  });

  it("collapses internal tabs and newlines to a single space", () => {
    expect(normalizeCategoryName("Driver\t\nsalary")).toBe("Driver salary");
  });

  it("normalizes an all-whitespace name to an empty string", () => {
    expect(normalizeCategoryName("   \t  ")).toBe("");
  });

  it("normalizes an empty string to an empty string", () => {
    expect(normalizeCategoryName("")).toBe("");
  });
});
