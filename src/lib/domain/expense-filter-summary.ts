import { formatLogDate } from "@/lib/domain/datetime";
import { formatMonthLabel, isMonthKey } from "@/lib/domain/expense-month";
import { formatMethod } from "@/lib/domain/money";

// What the "Total expenses" card is currently adding up, in words, so a
// filtered figure never reads like the whole year's. Empty when nothing is
// filtered.
export function summarizeExpenseFilters(filters: {
  month?: string;
  from?: string;
  to?: string;
  categoryName?: string;
  method?: string;
  q?: string;
}): string[] {
  const parts: string[] = [];

  if (isMonthKey(filters.month)) {
    parts.push(formatMonthLabel(filters.month));
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
