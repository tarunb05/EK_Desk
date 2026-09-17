// The SMS fallback carries only the pay page link, the amount, and the
// reference code (brief section on WhatsApp fallback) -- shorter than the
// WhatsApp message by design, not because sms: has a length limit this
// builder enforces.
export function buildSmsUrl(phone91: string, message: string): string {
  return `sms:${phone91}?body=${encodeURIComponent(message)}`;
}
