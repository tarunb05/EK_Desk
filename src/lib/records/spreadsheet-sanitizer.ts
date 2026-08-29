// Formula-injection (a.k.a. CSV/Excel injection) mitigation for the one
// export (phase 12.4) that writes free text an admin didn't type
// themselves into spreadsheet cells: actor_label, entity_label and
// summary all ultimately trace back to a student/expense/category name
// someone else entered when creating that row. If any of those starts
// with a character a spreadsheet application treats as a formula prefix
// (=, +, -, @, tab, carriage return), Excel/Sheets will try to evaluate it
// as a formula the moment the file is opened -- the standard, OWASP-
// documented mitigation is prefixing it with a single quote, which every
// major spreadsheet application then displays as the literal text without
// executing it.
const FORMULA_PREFIX_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function sanitizeForSpreadsheet(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_PREFIX_CHARS.has(value[0]!) ? `'${value}` : value;
}
