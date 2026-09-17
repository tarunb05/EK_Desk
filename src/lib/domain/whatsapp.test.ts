import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "./whatsapp";

describe("buildWhatsAppUrl", () => {
  it("builds a wa.me URL with the phone number in the path", () => {
    const url = buildWhatsAppUrl("919876543210", "hello");
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
  });

  it("encodes an & in the message", () => {
    const url = buildWhatsAppUrl("919876543210", "Transport & Daycare fee");
    expect(url).toContain(encodeURIComponent("Transport & Daycare fee"));
    expect(url).not.toContain("Transport & Daycare");
  });

  it("encodes a # in the message", () => {
    const url = buildWhatsAppUrl("919876543210", "Reference #EK-7F3KQ");
    expect(url).toContain(encodeURIComponent("Reference #EK-7F3KQ"));
  });

  it("encodes the ₹ symbol", () => {
    const url = buildWhatsAppUrl("919876543210", "Amount: ₹10,000");
    expect(url).toContain(encodeURIComponent("₹10,000"));
  });

  it("encodes newlines", () => {
    const url = buildWhatsAppUrl("919876543210", "Line one\nLine two");
    expect(url).toContain(encodeURIComponent("Line one\nLine two"));
    expect(url).not.toContain("\n");
  });
});
