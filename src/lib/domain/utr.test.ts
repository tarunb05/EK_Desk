import { describe, expect, it } from "vitest";
import { normalizeUtr } from "./utr";

describe("normalizeUtr", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeUtr("  312345678901  ")).toBe("312345678901");
  });

  it("strips internal spaces", () => {
    expect(normalizeUtr("3123 4567 8901")).toBe("312345678901");
  });

  it("uppercases a mixed-case alphanumeric bank reference", () => {
    expect(normalizeUtr("txn8f3kq2026")).toBe("TXN8F3KQ2026");
  });

  it("handles tabs and newlines as whitespace too", () => {
    expect(normalizeUtr("\t312345678901\n")).toBe("312345678901");
  });

  it("is a no-op on an already-clean UTR", () => {
    expect(normalizeUtr("312345678901")).toBe("312345678901");
  });

  it("handles an empty string", () => {
    expect(normalizeUtr("")).toBe("");
  });
});
