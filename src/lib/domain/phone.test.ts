import { describe, expect, it } from "vitest";
import { normalizeIndianMobile } from "./phone";

describe("normalizeIndianMobile", () => {
  it("normalizes a +91-prefixed, spaced number", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("919876543210");
  });

  it("normalizes a 0-prefixed, hyphenated number", () => {
    expect(normalizeIndianMobile("098765-43210")).toBe("919876543210");
  });

  it("normalizes a bare 10-digit number", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("919876543210");
  });

  it("normalizes a 91-prefixed number with no plus", () => {
    expect(normalizeIndianMobile("919876543210")).toBe("919876543210");
  });

  it("rejects a Delhi landline (011 STD code)", () => {
    expect(normalizeIndianMobile("011-23456789")).toBeNull();
  });

  it("rejects a Chennai landline (044 STD code)", () => {
    expect(normalizeIndianMobile("044-23456789")).toBeNull();
  });

  it("rejects a 9-digit number (too short)", () => {
    expect(normalizeIndianMobile("987654321")).toBeNull();
  });

  it("rejects an 11-digit number with no recognizable prefix", () => {
    expect(normalizeIndianMobile("12345678901")).toBeNull();
  });

  it("rejects a number not starting with 6-9 after normalization", () => {
    expect(normalizeIndianMobile("5876543210")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(normalizeIndianMobile("")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(normalizeIndianMobile("not a phone number")).toBeNull();
  });
});
