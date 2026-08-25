import { describe, expect, it } from "vitest";
import {
  formatPaise,
  paiseToRupees,
  parseRupeesToPaise,
  rupeesToPaise,
} from "./money";

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

describe("parseRupeesToPaise", () => {
  it("parses a whole rupee amount", () => {
    expect(parseRupeesToPaise("1234")).toBe(123_400n);
  });

  it("parses a clean two-decimal amount", () => {
    expect(parseRupeesToPaise("0.10")).toBe(10n);
  });

  it("parses a single-decimal amount by treating it as tenths", () => {
    expect(parseRupeesToPaise("5.5")).toBe(550n);
  });

  it("parses zero", () => {
    expect(parseRupeesToPaise("0")).toBe(0n);
  });

  it("rejects a thousands separator", () => {
    expect(parseRupeesToPaise("1,234.50")).toBeNull();
  });

  it("rejects more than two decimal places", () => {
    expect(parseRupeesToPaise("0.005")).toBeNull();
  });

  it("rejects a negative amount", () => {
    expect(parseRupeesToPaise("-5")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseRupeesToPaise("abc")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseRupeesToPaise("")).toBeNull();
  });

  it("rejects scientific notation", () => {
    expect(parseRupeesToPaise("1e5")).toBeNull();
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseRupeesToPaise("  42.00  ")).toBe(4_200n);
  });
});
