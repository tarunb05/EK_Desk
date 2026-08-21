import { describe, expect, it } from "vitest";
import { resolvePagination } from "./pagination";

describe("resolvePagination", () => {
  it("computes offset and limit for a normal page", () => {
    const result = resolvePagination(2, 25, 100);
    expect(result).toEqual({ page: 2, totalPages: 4, offset: 25, limit: 25 });
  });

  it("clamps a page below 1 up to 1", () => {
    const result = resolvePagination(0, 25, 100);
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it("clamps a page beyond the last page down to the last page", () => {
    const result = resolvePagination(99, 25, 100);
    expect(result.page).toBe(4);
    expect(result.offset).toBe(75);
  });

  it("treats zero rows as a single, empty page", () => {
    const result = resolvePagination(1, 25, 0);
    expect(result).toEqual({ page: 1, totalPages: 1, offset: 0, limit: 25 });
  });

  it("rounds totalPages up when the count doesn't divide evenly", () => {
    const result = resolvePagination(1, 25, 30);
    expect(result.totalPages).toBe(2);
  });
});
