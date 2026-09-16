import { describe, expect, it } from "vitest";
import { normalizeIndianMobile } from "./phone";

describe("normalizeIndianMobile", () => {
  it("accepts a number with a spaced +91 country code", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("919876543210");
  });

  it("accepts a number with a leading 0 trunk prefix and a dash", () => {
    expect(normalizeIndianMobile("098765-43210")).toBe("919876543210");
  });

  it("accepts a bare 10-digit mobile number", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("919876543210");
  });

  it("accepts a number with the 91 country code and no plus or spaces", () => {
    expect(normalizeIndianMobile("919876543210")).toBe("919876543210");
  });

  it("rejects a Delhi landline written with its STD code", () => {
    // 011 (Delhi STD) + 8-digit local number = 11 digits; stripping the
    // leading 0 leaves "1123456789", which starts with 1, not 6-9.
    expect(normalizeIndianMobile("011-23456789")).toBeNull();
  });

  it("rejects a 9-digit number (too short)", () => {
    expect(normalizeIndianMobile("987654321")).toBeNull();
  });

  it("rejects an 11-digit number that isn't a valid 0-prefixed mobile", () => {
    expect(normalizeIndianMobile("12345678901")).toBeNull();
  });

  it("rejects a number starting 0-5 after normalization", () => {
    expect(normalizeIndianMobile("5876543210")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(normalizeIndianMobile("")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(normalizeIndianMobile("not a phone number")).toBeNull();
  });
});
