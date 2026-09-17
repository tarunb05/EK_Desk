import { describe, expect, it } from "vitest";
import {
  REFERENCE_CODE_LENGTH,
  generateReferenceCode,
  referenceCodeFromBytes,
} from "./payment-request-code";

describe("referenceCodeFromBytes", () => {
  it("is deterministic for the same bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4]);
    expect(referenceCodeFromBytes(bytes)).toBe(referenceCodeFromBytes(bytes));
  });

  it("prefixes every code with EK-", () => {
    const code = referenceCodeFromBytes(new Uint8Array([0, 0, 0, 0, 0]));
    expect(code.startsWith("EK-")).toBe(true);
  });

  it("produces exactly REFERENCE_CODE_LENGTH characters after the prefix", () => {
    const code = referenceCodeFromBytes(new Uint8Array([10, 20, 30, 40, 50]));
    expect(code.slice(3)).toHaveLength(REFERENCE_CODE_LENGTH);
  });

  it("never contains 0, O, 1, I, or L", () => {
    // Sweep every byte value through every position -- with a 32-character
    // alphabet and byte % 32, this exercises the full alphabet.
    for (let value = 0; value < 256; value++) {
      const code = referenceCodeFromBytes(
        new Uint8Array([value, value, value, value, value]),
      );
      expect(code.slice(3)).not.toMatch(/[0O1IL]/);
    }
  });

  it("throws if fewer than REFERENCE_CODE_LENGTH bytes are given", () => {
    expect(() => referenceCodeFromBytes(new Uint8Array([1, 2]))).toThrow();
  });

  it("produces different codes for different bytes", () => {
    const a = referenceCodeFromBytes(new Uint8Array([1, 2, 3, 4, 5]));
    const b = referenceCodeFromBytes(new Uint8Array([5, 4, 3, 2, 1]));
    expect(a).not.toBe(b);
  });
});

describe("generateReferenceCode", () => {
  it("matches the EK-XXXXX shape with no ambiguous characters", () => {
    const code = generateReferenceCode();
    expect(code).toMatch(/^EK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
  });
});
