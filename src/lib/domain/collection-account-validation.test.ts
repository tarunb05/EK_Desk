import { describe, expect, it } from "vitest";
import {
  isValidAccountNumber,
  isValidIfsc,
  isValidUpiId,
} from "./collection-account-validation";

describe("isValidUpiId", () => {
  it("accepts a phone-number-style VPA", () => {
    expect(isValidUpiId("9876543210@upi")).toBe(true);
  });

  it("accepts a name-style VPA with dots and hyphens", () => {
    expect(isValidUpiId("eurokids.kothanur-main@okhdfcbank")).toBe(true);
  });

  it("rejects a value with no @", () => {
    expect(isValidUpiId("9876543210")).toBe(false);
  });

  it("rejects a value with a numeric-only suffix", () => {
    expect(isValidUpiId("someone@123")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidUpiId("")).toBe(false);
  });
});

describe("isValidIfsc", () => {
  it("accepts a well-formed IFSC", () => {
    expect(isValidIfsc("HDFC0001234")).toBe(true);
  });

  it("accepts lowercase and normalizes case", () => {
    expect(isValidIfsc("hdfc0001234")).toBe(true);
  });

  it("rejects a code missing the required 0 in the 5th position", () => {
    expect(isValidIfsc("HDFC1001234")).toBe(false);
  });

  it("rejects a code with the wrong length", () => {
    expect(isValidIfsc("HDFC001234")).toBe(false);
  });

  it("rejects a code with digits in the bank-code prefix", () => {
    expect(isValidIfsc("HD1C0001234")).toBe(false);
  });
});

describe("isValidAccountNumber", () => {
  it("accepts a 9-digit account number (minimum length)", () => {
    expect(isValidAccountNumber("123456789")).toBe(true);
  });

  it("accepts an 18-digit account number (maximum length)", () => {
    expect(isValidAccountNumber("123456789012345678")).toBe(true);
  });

  it("rejects a number shorter than 9 digits", () => {
    expect(isValidAccountNumber("12345678")).toBe(false);
  });

  it("rejects a number longer than 18 digits", () => {
    expect(isValidAccountNumber("1234567890123456789")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(isValidAccountNumber("12345-6789")).toBe(false);
  });
});
