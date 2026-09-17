import { describe, expect, it } from "vitest";
import { validateRequestAmount } from "./payment-request-amount";

describe("validateRequestAmount", () => {
  it("accepts a part payment less than pending", () => {
    expect(validateRequestAmount(4_000_00n, 10_000_00n)).toEqual({ ok: true });
  });

  it("accepts an amount exactly equal to pending", () => {
    expect(validateRequestAmount(10_000_00n, 10_000_00n)).toEqual({
      ok: true,
    });
  });

  it("rejects an amount above pending", () => {
    const result = validateRequestAmount(10_000_01n, 10_000_00n);
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("rejects a zero amount", () => {
    const result = validateRequestAmount(0n, 10_000_00n);
    expect(result.ok).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = validateRequestAmount(-1n, 10_000_00n);
    expect(result.ok).toBe(false);
  });
});
