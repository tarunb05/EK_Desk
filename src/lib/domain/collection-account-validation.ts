// A UPI VPA: a handle, an @, then a bank/PSP suffix. Deliberately permissive
// on the handle (banks and PSPs allow phone numbers, names, and merchant
// codes there) -- the @<suffix> shape is the one structural rule that's
// actually load-bearing.
const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidUpiId(value: string): boolean {
  return UPI_ID_PATTERN.test(value.trim());
}

// 4 bank-code letters, a literal 0 (reserved for future use by RBI), 6
// alphanumeric branch-code characters -- 11 characters total, the fixed
// shape every Indian bank's IFSC follows.
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function isValidIfsc(value: string): boolean {
  return IFSC_PATTERN.test(value.trim().toUpperCase());
}

// Indian bank account numbers vary by bank (typically 9-18 digits) with no
// single national standard -- unlike IFSC, there's no fixed shape to check
// beyond "digits, a plausible length".
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;

export function isValidAccountNumber(value: string): boolean {
  return ACCOUNT_NUMBER_PATTERN.test(value.trim());
}
