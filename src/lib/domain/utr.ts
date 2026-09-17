// A parent's UTR (UPI) or bank reference, however they typed it -- trimmed,
// internal spaces stripped (a UTR is sometimes copied from an SMS with
// stray spacing), uppercased for a consistent comparison against
// payment_claim's own unique-when-confirmed index.
export function normalizeUtr(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}
