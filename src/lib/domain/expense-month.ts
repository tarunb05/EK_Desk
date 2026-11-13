// The Expenses page's Month filter is "YYYY-MM" in the URL (?month=2026-11)
// and means "spent on any day of that calendar month". It combines with the
// custom From/To range by intersection, so a hand-typed URL carrying both
// still means something sensible.
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
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

export function isMonthKey(value: string | undefined): value is string {
  return value !== undefined && MONTH_KEY.test(value);
}

// "2026-11" -> "November 2026"
export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_NAMES[Number(monthNumber) - 1] ?? month} ${year}`;
}

// Inclusive first and last day, as "YYYY-MM-DD".
export function monthBounds(month: string): { from: string; to: string } {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const mm = String(monthNumber).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

// One resolved range for every consumer of the filters (the table, the
// card, the category chart, the Excel export), so they can't disagree about
// what "November, from the 10th" means. ISO dates compare correctly as text.
export function resolveExpenseDateRange(filters: {
  month?: string;
  from?: string;
  to?: string;
}): { from?: string; to?: string } {
  const bounds = isMonthKey(filters.month)
    ? monthBounds(filters.month)
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
