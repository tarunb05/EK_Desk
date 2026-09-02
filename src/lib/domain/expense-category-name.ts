// Trim + collapse internal whitespace, nothing more -- case-insensitive
// duplicate detection needs a lookup against existing rows, so that part
// happens in the Server Action, not here.
export function normalizeCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
