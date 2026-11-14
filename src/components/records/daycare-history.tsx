import { formatPaise } from "@/lib/domain/money";
import { formatDateRange } from "@/lib/domain/enrollment-label";
import {
  buildSchedule,
  summarizeDaycare,
  type ScheduleState,
} from "@/lib/domain/daycare-history";
import type { StudentFeeAccountDetail } from "@/lib/records/student-detail";

const STATE_LABEL: Record<ScheduleState, string> = {
  upcoming: "Upcoming",
  current: "Current",
  past: "Past",
  discontinued: "Discontinued",
};

// A text label always, never colour alone; the colour only reinforces it.
const STATE_CLASS: Record<ScheduleState, string> = {
  upcoming: "border-border text-ink",
  current: "border-accent text-accent",
  past: "border-hairline text-ink-muted",
  discontinued: "border-attention text-attention",
};

// A returning student's daycare record: running totals and the schedule of
// every stint, newest first (so upcoming ones sit on top). Everything here
// is worked out from the enrollments and payments when the page loads --
// see lib/domain/daycare-history.ts for exactly what each number counts.
export function DaycareHistory({
  accounts,
  today,
}: {
  accounts: StudentFeeAccountDetail[];
  today: string;
}) {
  const facts = accounts.map((account) => ({
    feeAccountId: account.feeAccountId,
    startsOn: account.startsOn,
    endsOn: account.endsOn,
    slot: account.slot,
    status: account.status,
    totalReceivablePaise: account.totalReceivablePaise,
    payments: account.payments,
  }));
  const summary = summarizeDaycare(facts);
  const schedule = buildSchedule(facts, today);

  const tiles = [
    { label: "Daycare sessions", value: String(summary.sessions) },
    { label: "Days booked", value: String(summary.daysBooked) },
    { label: "Payments", value: String(summary.paymentCount) },
    { label: "Total paid", value: formatPaise(summary.totalPaidPaise) },
  ];

  return (
    <section aria-label="Daycare history" className="mb-6">
      <h3 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
        Daycare history
      </h3>

      <dl className="mb-4 grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-hairline bg-surface p-3"
          >
            <dt className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
              {tile.label}
            </dt>
            <dd className="mt-1 text-base font-medium tabular-nums text-ink">
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="mb-1 text-2xs font-medium uppercase tracking-wide text-ink-muted">
        Schedule
      </h3>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {schedule.map((entry) => (
          <li
            key={entry.feeAccountId}
            className="flex items-start justify-between gap-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-ink">
                  {formatDateRange(entry.startsOn, entry.endsOn)}
                </span>
                <span
                  className={`rounded-md border px-1.5 text-2xs uppercase tracking-wide ${STATE_CLASS[entry.state]}`}
                >
                  {STATE_LABEL[entry.state]}
                </span>
              </div>
              <div className="text-xs text-ink-muted">
                {entry.days} {entry.days === 1 ? "day" : "days"}
                {entry.slot ? ` · ${entry.slot}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs tabular-nums text-ink-secondary">
              {formatPaise(entry.paidPaise)} of{" "}
              {formatPaise(entry.totalReceivablePaise)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
