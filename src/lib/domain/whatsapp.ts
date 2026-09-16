import { formatPaise } from "./money";

export interface PaymentLinkShareMessage {
  branchName: string;
  serviceType: "transport" | "daycare";
  // First name only (Phase 15 brief) -- a WhatsApp message isn't the
  // student record, and doesn't need the child's full name to be useful.
  childFirstName: string;
  amountPaise: bigint;
  // Already formatted for display (e.g. "25 Sep 2026") -- IST conversion
  // and formatting is the caller's job (see datetime.ts's
  // toISTDateString), this only composes the message.
  expiryDateDisplay: string;
  shortUrl: string;
}

// wa.me's click-to-chat URL, prefilled with a short, plain message (no
// emoji, per CLAUDE.md) -- this only builds the string; rendering it as a
// real <a href target="_blank" rel="noopener noreferrer"> (not
// window.open) is the UI's job (Phase 15.4). `phoneE164` is the
// normalizeIndianMobile() output, already validated by the caller.
export function buildPaymentLinkWhatsAppUrl(
  message: PaymentLinkShareMessage,
  phoneE164: string,
): string {
  const serviceLabel =
    message.serviceType === "transport" ? "Transport" : "Daycare";

  const text = [
    `${message.branchName} — ${serviceLabel} fee for ${message.childFirstName}`,
    `Amount due: ${formatPaise(message.amountPaise)}`,
    `Pay here (valid until ${message.expiryDateDisplay}): ${message.shortUrl}`,
    "The school will never ask you for a UPI PIN or OTP.",
  ].join("\n\n");

  return `https://wa.me/${phoneE164}?text=${encodeURIComponent(text)}`;
}
