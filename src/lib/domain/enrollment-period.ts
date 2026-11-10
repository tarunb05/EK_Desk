// Daycare parents enroll for a week, a month, or the year -- this only
// pre-fills the Ends on date from Starts on; staff can still edit both, and
// the period itself isn't stored (the dates are the record).
export const ENROLLMENT_PERIODS = ["weekly", "monthly", "yearly"] as const;
export type EnrollmentPeriod = (typeof ENROLLMENT_PERIODS)[number];

// All dates are "YYYY-MM-DD" strings, done in UTC so no timezone can shift
// a day.
function parse(iso: string): Date {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

// Same day next month, clamped to that month's last day (31 Jan -> 28 Feb).
function addOneMonth(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

// Inclusive end date: a week from 10 Nov ends 16 Nov, a month from 10 Nov
// ends 9 Dec, a year ends on the academic year's own last day.
export function enrollmentEndsOn(
  startsOn: string,
  period: EnrollmentPeriod,
  academicYearEndsOn: string,
): string {
  const start = parse(startsOn);
  if (period === "weekly") return format(addDays(start, 6));
  if (period === "monthly") return format(addDays(addOneMonth(start), -1));
  // Starting after the academic year has ended would make Ends on earlier
  // than Starts on; fall back to a calendar year from the start instead.
  if (startsOn <= academicYearEndsOn) return academicYearEndsOn;
  const nextYear = new Date(
    Date.UTC(
      start.getUTCFullYear() + 1,
      start.getUTCMonth(),
      start.getUTCDate(),
    ),
  );
  return format(addDays(nextYear, -1));
}

// Inclusive on both ends, matching the daterange '[]' the database's
// no-overlap constraint uses. ISO date strings compare correctly as text.
export function enrollmentsOverlap(
  a: { startsOn: string; endsOn: string },
  b: { startsOn: string; endsOn: string },
): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}
