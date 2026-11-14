import type { AcademicYearRange } from "./types";

export function isWithinAcademicYear(
  date: Date,
  year: AcademicYearRange,
): boolean {
  return date >= year.startsOn && date <= year.endsOn;
}

// The academic year a "YYYY-MM-DD" date falls in (both ends included), or
// null when it falls in a gap between years. Plain ISO strings compare
// correctly as text, which is what the enrollment forms already hold.
export function academicYearContaining<
  T extends { startsOn: string; endsOn: string },
>(date: string, years: T[]): T | null {
  return years.find((y) => date >= y.startsOn && date <= y.endsOn) ?? null;
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

// The academic year a screen opens on when the URL names none: the one that
// contains today, and only if there is no such row, the one flagged current.
//
// The flag alone is not enough. It is moved by a nightly database job
// (roll_academic_year), so between midnight on 1 April and that job's next
// run -- or for as long as the job hasn't run at all, e.g. a hosted
// database that was paused over the new year -- the flag still points at
// the year that has just ended. Reading the dates means the new year is
// the default from the first request on 1 April wherever its row exists,
// and a year flagged current by hand in Settings still wins whenever today
// falls outside every year on file.
export function defaultAcademicYear<
  T extends { startsOn: string; endsOn: string; isCurrent: boolean },
>(years: T[], today: string): T | undefined {
  return (
    academicYearContaining(today, years) ??
    years.find((year) => year.isCurrent) ??
    years[0]
  );
}
