// phone is the normalized 91XXXXXXXXXX form from normalizeIndianMobile --
// wa.me takes a number with no + and no leading zeros. encodeURIComponent
// on the message handles &, #, ₹, and newlines correctly for a query string.
export function buildWhatsAppUrl(phone91: string, message: string): string {
  return `https://wa.me/${phone91}?text=${encodeURIComponent(message)}`;
}
