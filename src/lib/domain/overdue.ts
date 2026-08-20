import type { AgeingBucket } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

// due_date is a Postgres DATE (no time component); callers must pass UTC
// midnight Date objects so this stays a pure calendar-day comparison.
function daysOverdue(dueDate: Date, asOf: Date): number {
  return Math.floor((asOf.getTime() - dueDate.getTime()) / DAY_MS);
}

export function isOverdue(
  pendingPaise: bigint,
  dueDate: Date,
  asOf: Date,
): boolean {
  return pendingPaise > 0n && daysOverdue(dueDate, asOf) > 0;
}

export function ageingBucket(
  pendingPaise: bigint,
  dueDate: Date,
  asOf: Date,
): AgeingBucket {
  if (!isOverdue(pendingPaise, dueDate, asOf)) {
    return "not_yet_due";
  }

  const days = daysOverdue(dueDate, asOf);
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  return "60+";
}
