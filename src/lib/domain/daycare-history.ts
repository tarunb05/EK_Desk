// A returning daycare student has one fee_account per stint. Everything on
// the student's page about their history -- how many sessions, how many
// days, what they've paid -- is derived here from those rows when it's
// read, never stored, the same way pending is never stored (CLAUDE.md rule
// 3): a stored counter could drift from the payments it summarises.
//
// Definitions, so the numbers mean the same thing everywhere:
// - A session is one non-discontinued daycare enrollment. A discontinued
//   enrollment was cancelled, so it isn't counted as a session or as days.
// - Days booked are the inclusive days each of those enrollments covers.
// - Payments and the total paid count every non-voided payment on any of the
//   student's daycare enrollments, discontinued ones too -- money that was
//   really paid stays paid. Voided payments are excluded (CLAUDE.md rule 2).

export type ScheduleState = "upcoming" | "current" | "past" | "discontinued";

export interface DaycareAccountFacts {
  feeAccountId: string;
  startsOn: string;
  endsOn: string;
  slot: string | null;
  status: string;
  totalReceivablePaise: bigint;
  payments: { amountPaise: bigint; voidedAt: string | null }[];
}

export interface DaycareSummary {
  sessions: number;
  daysBooked: number;
  paymentCount: number;
  totalPaidPaise: bigint;
}

export interface ScheduleEntry {
  feeAccountId: string;
  startsOn: string;
  endsOn: string;
  days: number;
  slot: string | null;
  state: ScheduleState;
  totalReceivablePaise: bigint;
  paidPaise: bigint;
}

function utcDay(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// Both ends included: 11 Nov to 17 Nov is 7 days.
export function inclusiveDays(startsOn: string, endsOn: string): number {
  const days = Math.round((utcDay(endsOn) - utcDay(startsOn)) / 86_400_000) + 1;
  return Math.max(days, 0);
}

export function scheduleState(
  account: Pick<DaycareAccountFacts, "startsOn" | "endsOn" | "status">,
  today: string,
): ScheduleState {
  if (account.status === "discontinued") return "discontinued";
  if (today < account.startsOn) return "upcoming";
  if (today > account.endsOn) return "past";
  return "current";
}

function paidOn(account: DaycareAccountFacts): bigint {
  return account.payments
    .filter((payment) => payment.voidedAt === null)
    .reduce((sum, payment) => sum + payment.amountPaise, 0n);
}

export function summarizeDaycare(
  accounts: DaycareAccountFacts[],
): DaycareSummary {
  const counted = accounts.filter((a) => a.status !== "discontinued");
  const livePayments = accounts.flatMap((a) =>
    a.payments.filter((payment) => payment.voidedAt === null),
  );

  return {
    sessions: counted.length,
    daysBooked: counted.reduce(
      (sum, a) => sum + inclusiveDays(a.startsOn, a.endsOn),
      0,
    ),
    paymentCount: livePayments.length,
    totalPaidPaise: livePayments.reduce((sum, p) => sum + p.amountPaise, 0n),
  };
}

// Newest first, so upcoming stints sit at the top and the oldest at the
// bottom.
export function buildSchedule(
  accounts: DaycareAccountFacts[],
  today: string,
): ScheduleEntry[] {
  return accounts
    .map((account) => ({
      feeAccountId: account.feeAccountId,
      startsOn: account.startsOn,
      endsOn: account.endsOn,
      days: inclusiveDays(account.startsOn, account.endsOn),
      slot: account.slot,
      state: scheduleState(account, today),
      totalReceivablePaise: account.totalReceivablePaise,
      paidPaise: paidOn(account),
    }))
    .sort(
      (a, b) =>
        b.startsOn.localeCompare(a.startsOn) ||
        b.endsOn.localeCompare(a.endsOn),
    );
}
