import { formatLogDate } from "@/lib/domain/datetime";
import { isMonth, isYear, monthName } from "@/lib/domain/expense-month";
import { formatMethod } from "@/lib/domain/money";

// What the "Total expenses" card is currently adding up, in words, so a
// filtered figure never reads like the whole year's. The first part is the
// period ("2026", or "November 2026" once a month is chosen); the rest are
// whichever other filters are active.
export function summarizeExpenseFilters(filters: {
  year?: string;
  month?: string;
  from?: string;
  to?: string;
  categoryName?: string;
  method?: string;
  q?: string;
}): string[] {
  const parts: string[] = [];

  if (isYear(filters.year)) {
    parts.push(
      isMonth(filters.month)
        ? `${monthName(filters.month)} ${filters.year}`
        : filters.year,
    );
  }
  if (filters.from && filters.to) {
    parts.push(`${formatLogDate(filters.from)} – ${formatLogDate(filters.to)}`);
  } else if (filters.from) {
    parts.push(`from ${formatLogDate(filters.from)}`);
  } else if (filters.to) {
    parts.push(`up to ${formatLogDate(filters.to)}`);
  }
  if (filters.categoryName) {
    parts.push(filters.categoryName);
  }
  if (filters.method && filters.method !== "all") {
    parts.push(formatMethod(filters.method));
  }
  if (filters.q) {
    parts.push(`matching “${filters.q}”`);
  }

  return parts;
}
