const PAISE_PER_RUPEE = 100;

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function paiseToRupees(paise: bigint): number {
  return Number(paise) / PAISE_PER_RUPEE;
}

export function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * PAISE_PER_RUPEE));
}

export function formatPaise(paise: bigint): string {
  return inrFormatter.format(paiseToRupees(paise));
}

// The inverse of parseRupeesToPaise, for prefilling an edit form's amount
// field -- pure integer string manipulation (no division-as-float), so a
// stored value round-trips through the form exactly, not "close enough".
export function paiseToRupeesInputString(paise: bigint): string {
  const whole = paise / 100n;
  const cents = (paise % 100n).toString().padStart(2, "0");
  return `${whole}.${cents}`;
}

// Shared across every "how was this paid" field in the app (payment,
// expense) -- same domain, same values, one type, never forked per field.
export const MONEY_METHODS = ["cash", "upi", "cheque", "bank_transfer"] as const;
export type MoneyMethod = (typeof MONEY_METHODS)[number];

export const EXPENSE_SANITY_CEILING_PAISE = 50_000_000n; // ₹5,00,000

// Parses a rupee amount typed by hand -- deliberately never touches
// Number()/parseFloat, so there's no float rounding to reason about and no
// risk of accepting scientific notation ("1e5") the way Number() would.
// The regex alone is the whole validation: optional decimal point, at most
// two digits after it, no thousands separators, no sign. Returns null for
// anything that doesn't match -- callers decide what "invalid" means for
// their field (this doesn't reject zero; a caller wanting a strictly
// positive amount checks that separately).
export function parseRupeesToPaise(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [rupees, paise = ""] = trimmed.split(".");
  return BigInt(rupees) * 100n + BigInt(paise.padEnd(2, "0"));
}
