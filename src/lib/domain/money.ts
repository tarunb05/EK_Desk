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

// payment only: 'card' means a parent paid at the office on a POS machine
// (Phase 15, office card payments) -- money coming in, never something the
// school spent (expense). The legacy payment_submission table keeps the
// plain MONEY_METHODS list. Forked here rather than widening MONEY_METHODS
// itself, so expense.method can't accidentally grow a method that has no
// meaning for money going out.
export const PAYMENT_METHODS = [...MONEY_METHODS, "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// The one place a method's display name lives -- every list, option and
// table reads this rather than its own copy.
export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  cheque: "Cheque",
  bank_transfer: "Bank transfer",
  card: "Card (at office)",
};

// For a value read from the database as a plain string; falls back to the
// raw value so an unexpected method still shows rather than disappearing.
export function formatMethod(method: string): string {
  return METHOD_LABELS[method as PaymentMethod] ?? method;
}

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
