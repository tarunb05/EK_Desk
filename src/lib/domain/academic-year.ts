import type { AcademicYearRange } from "./types";

export function isWithinAcademicYear(
  date: Date,
  year: AcademicYearRange,
): boolean {
  return date >= year.startsOn && date <= year.endsOn;
}
