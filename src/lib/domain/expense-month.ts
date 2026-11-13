// The Expenses page filters by calendar year (?year=2026) and, within it, by
// month (?month=11, January to December with no year attached -- the year
// comes from the Year filter). Both mean "spent on a day inside it", and they
// combine with the custom From/To range by intersection, so a hand-typed URL
// carrying several still means something sensible.
const YEAR = /^\d{4}$/;
const MONTH = /^([1-9]|1[0-2])$/;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function isYear(value: string | undefined): value is string {
  return value !== undefined && YEAR.test(value);
}

export function isMonth(value: string | undefined): value is string {
  return value !== undefined && MONTH.test(value);
}

// "11" -> "November"
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month) - 1] ?? month;
}

// Inclusive first and last day, as "YYYY-MM-DD". Without a month, the whole
// year.
export function periodBounds(
  year: string,
  month?: string,
): { from: string; to: string } {
  if (!isMonth(month)) {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const monthNumber = Number(month);
  const lastDay = new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate();
  const mm = String(monthNumber).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

// One resolved range for every consumer of the filters (the table, the
// card, the category chart, the Excel export), so they can't disagree about
// what "November, from the 10th" means. ISO dates compare correctly as text.
// A month on its own (no year) has no calendar to sit in, so it's ignored.
export function resolveExpenseDateRange(filters: {
  year?: string;
  month?: string;
  from?: string;
  to?: string;
}): { from?: string; to?: string } {
  const bounds = isYear(filters.year)
    ? periodBounds(filters.year, filters.month)
    : undefined;

  const froms = [bounds?.from, filters.from || undefined].filter(
    (value): value is string => value !== undefined,
  );
  const tos = [bounds?.to, filters.to || undefined].filter(
    (value): value is string => value !== undefined,
  );

  return {
    from:
      froms.length > 0 ? froms.reduce((a, b) => (a > b ? a : b)) : undefined,
    to: tos.length > 0 ? tos.reduce((a, b) => (a < b ? a : b)) : undefined,
  };
}
