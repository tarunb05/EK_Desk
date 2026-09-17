import { describe, expect, it } from "vitest";
import { buildSmsUrl } from "./sms";

describe("buildSmsUrl", () => {
  it("builds an sms: URL with the phone number and encoded body", () => {
    const url = buildSmsUrl("919876543210", "Pay ₹10,000 by 01-Jun-2026");
    expect(url).toBe(
      `sms:919876543210?body=${encodeURIComponent("Pay ₹10,000 by 01-Jun-2026")}`,
    );
  });

  it("encodes & and # in the body", () => {
    const url = buildSmsUrl("919876543210", "Ref #EK-7F3KQ & pay soon");
    expect(url).toContain(encodeURIComponent("Ref #EK-7F3KQ & pay soon"));
  });
});
