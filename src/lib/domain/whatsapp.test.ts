import { describe, expect, it } from "vitest";
import { buildPaymentLinkWhatsAppUrl } from "./whatsapp";

const baseMessage = {
  branchName: "Kothanur",
  serviceType: "transport" as const,
  childFirstName: "Aarav",
  amountPaise: 5_000_00n,
  expiryDateDisplay: "25 Sep 2026",
  shortUrl: "https://rzp.io/i/abc123",
};

describe("buildPaymentLinkWhatsAppUrl", () => {
  it("targets wa.me with the normalized phone number", () => {
    const url = buildPaymentLinkWhatsAppUrl(baseMessage, "919876543210");
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
  });

  it("encodes newlines between message sections", () => {
    const url = buildPaymentLinkWhatsAppUrl(baseMessage, "919876543210");
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("\n\n");
  });

  it("percent-encodes an ampersand in a branch name", () => {
    const url = buildPaymentLinkWhatsAppUrl(
      { ...baseMessage, branchName: "Smith & Sons Kothanur" },
      "919876543210",
    );
    expect(url).toContain("Smith%20%26%20Sons");
    expect(url).not.toContain("Smith & Sons");
  });

  it("percent-encodes a hash in a branch name", () => {
    const url = buildPaymentLinkWhatsAppUrl(
      { ...baseMessage, branchName: "Block #4 Kothanur" },
      "919876543210",
    );
    expect(url).toContain("Block%20%234");
    expect(url).not.toContain("#4 Kothanur");
  });

  it("round-trips the exact message content through encode/decode", () => {
    const url = buildPaymentLinkWhatsAppUrl(baseMessage, "919876543210");
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Kothanur");
    expect(text).toContain("Aarav");
    expect(text).toContain("Transport");
    expect(text).toContain("₹5,000");
    expect(text).toContain("25 Sep 2026");
    expect(text).toContain(baseMessage.shortUrl);
    expect(text.toLowerCase()).toContain("upi pin");
  });

  it("labels a daycare request as Daycare, not Transport", () => {
    const url = buildPaymentLinkWhatsAppUrl(
      { ...baseMessage, serviceType: "daycare" },
      "919876543210",
    );
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain("Daycare");
    expect(text).not.toContain("Transport");
  });

  it("contains no emoji", () => {
    const url = buildPaymentLinkWhatsAppUrl(baseMessage, "919876543210");
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
