import type { AcademicYearRange } from "./types";

export function isWithinAcademicYear(
  date: Date,
  year: AcademicYearRange,
): boolean {
  return date >= year.startsOn && date <= year.endsOn;
}

// Produces the 12 "YYYY-MM" keys spanning one academic year starting on
// startsOn (e.g. "2026-04-01" -> Apr 2026 .. Mar 2027). Originally lived
// only inside service-scope-dashboard.tsx (the dashboards' month filter);
// moved here so the activity log's month filter (phase 12.3) can use the
// same function instead of a second copy -- a duplicate would be a bug
// waiting for the next April rollover, not just untidy.
export function generateTwelveMonths(startsOn: string): string[] {
  const [startYear, startMonth] = startsOn.split("-").map(Number);
  if (!startYear || !startMonth) return [];

  return Array.from({ length: 12 }, (_, i) => {
    const monthIndex = startMonth - 1 + i;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}
