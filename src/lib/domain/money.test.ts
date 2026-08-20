import { describe, expect, it } from "vitest";
import { formatPaise, paiseToRupees, rupeesToPaise } from "./money";

describe("paiseToRupees", () => {
  it("converts whole rupees", () => {
    expect(paiseToRupees(10_000n)).toBe(100);
  });

  it("converts fractional paise exactly, with no rounding", () => {
    expect(paiseToRupees(150n)).toBe(1.5);
  });

  it("handles zero", () => {
    expect(paiseToRupees(0n)).toBe(0);
  });

  it("handles negative paise", () => {
    expect(paiseToRupees(-500n)).toBe(-5);
  });
});

describe("rupeesToPaise", () => {
  it("converts whole rupees", () => {
    expect(rupeesToPaise(100)).toBe(10_000n);
  });

  it("rounds fractional rupee input to the nearest paise", () => {
    expect(rupeesToPaise(19.99)).toBe(1_999n);
  });

  it("handles zero", () => {
    expect(rupeesToPaise(0)).toBe(0n);
  });
});

describe("formatPaise", () => {
  it("formats with Indian digit grouping and the rupee symbol", () => {
    expect(formatPaise(124_500_00n)).toBe("₹1,24,500");
  });

  it("formats zero", () => {
    expect(formatPaise(0n)).toBe("₹0");
  });

  it("formats negative amounts", () => {
    expect(formatPaise(-50_000n)).toBe("-₹500");
  });

  it("rounds to the nearest rupee for display, never showing paise", () => {
    expect(formatPaise(150n)).toBe("₹2");
  });
});
