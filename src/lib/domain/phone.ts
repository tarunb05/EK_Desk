// Returns the 91XXXXXXXXXX form wa.me's click-to-chat URL expects, or null
// if `raw` isn't a plausible Indian mobile number -- disable the "Send on
// WhatsApp" button and say why (Phase 15 brief), never guess and send to
// a wrong number.
//
// A genuine Indian mobile number is exactly 10 digits starting 6-9 (TRAI's
// numbering plan). Strip at most one leading "91" (country code) or "0"
// (trunk prefix) before checking that.
//
// ponytail: this can't perfectly distinguish a mobile number typed with a
// leading trunk "0" from a landline whose STD code happens to start 6-9
// (none of India's major metro codes do, but a handful of smaller circles
// might) -- a false positive there is rare and the parent's WhatsApp send
// simply fails to deliver rather than reaching a stranger. Revisit with a
// real STD-code table if this ever matters in practice.
export function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  const stripped =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;

  if (!/^[6-9]\d{9}$/.test(stripped)) {
    return null;
  }
  return `91${stripped}`;
}
