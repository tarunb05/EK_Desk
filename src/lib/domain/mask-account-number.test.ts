import { describe, expect, it } from "vitest";
import { maskAccountNumber } from "./mask-account-number";

describe("maskAccountNumber", () => {
  it("shows only the last 4 digits of a typical account number", () => {
    expect(maskAccountNumber("123456789012")).toBe("••••9012");
  });

  it("shows only the last 4 digits of a long, 18-digit account number", () => {
    expect(maskAccountNumber("123456789012345678")).toBe("••••5678");
  });

  it("handles the minimum valid length (9 digits)", () => {
    expect(maskAccountNumber("123456789")).toBe("••••6789");
  });

  it("shows the whole number when it's exactly 4 digits (defensive edge case)", () => {
    expect(maskAccountNumber("1234")).toBe("••••1234");
  });

  it("shows the whole number when it's shorter than 4 digits (defensive edge case)", () => {
    expect(maskAccountNumber("12")).toBe("••••12");
  });
});
