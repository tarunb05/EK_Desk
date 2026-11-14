import { formatPaise, formatPaiseCompact } from "@/lib/domain/money";
import { ChartEmpty } from "./chart-card";

export interface MonthColumn {
  // "2026-04"
  month: string;
  paise: bigint;
  // A month outside the active filter: still drawn, in the quiet colour.
  dimmed?: boolean;
}

const shortMonth = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
});
const longMonth = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthDate(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (monthNumber ?? 1) - 1, 1));
}

// The smallest "clean" number at or above the largest column, so the top
// gridline is a round figure (₹50K, not ₹47,300) and the tallest column
// never touches the top of the plot.
function niceCeiling(paise: bigint): bigint {
  const rupees = Number(paise) / 100;
  if (rupees <= 0) return 0n;
  const magnitude = 10 ** Math.floor(Math.log10(rupees));
  const step =
    [1, 1.5, 2, 2.5, 5, 10].find((s) => s * magnitude >= rupees) ?? 10;
  return BigInt(Math.round(step * magnitude * 100));
}

// A column per month, one series, one baseline. Used for fee collections on
// the Transport/Daycare dashboards and for spend on Expenses -- the caller
// names what the columns are (`valueLabel`) and the surrounding ChartCard
// carries the title, so there is no legend: one colour, one thing plotted.
//
// Server-rendered, no JS: the hover readout is a CSS-only tooltip, and the
// same figures are repeated in a visually-hidden table so a screen reader
// (or anyone who can't hover) gets every value, not only the labelled peak.
export function MonthColumns({
  columns,
  valueLabel,
  emptyText,
}: {
  columns: MonthColumn[];
  valueLabel: string;
  emptyText: string;
}) {
  const max = columns.reduce((m, c) => (c.paise > m ? c.paise : m), 0n);
  if (max === 0n) {
    return <ChartEmpty>{emptyText}</ChartEmpty>;
  }

  const ceiling = niceCeiling(max);
  const ticks = [ceiling, ceiling / 2n, 0n];
  // Direct-label the peak only; every other value is on hover and in the
  // table. A number over all twelve columns would be unreadable.
  const peakIndex = columns.findIndex((c) => c.paise === max);

  return (
    <div>
      <div className="flex gap-2" aria-hidden="true">
        <div className="flex h-44 w-10 shrink-0 flex-col justify-between text-right text-2xs tabular-nums text-ink-muted">
          {ticks.map((tick) => (
            <span
              key={String(tick)}
              className="-translate-y-1/2 last:translate-y-1/2"
            >
              {formatPaiseCompact(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44">
            {/* Gridlines: hairline, solid, behind the columns. */}
            <div className="absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-hairline" />
              <div className="border-t border-hairline" />
              <div className="border-t border-border" />
            </div>

            <div className="absolute inset-0 flex items-end">
              {columns.map((column, index) => {
                const heightPercent =
                  (Number(column.paise) / Number(ceiling)) * 100;
                return (
                  <div
                    key={column.month}
                    className="group relative flex h-full flex-1 items-end justify-center"
                  >
                    {column.paise > 0n ? (
                      <div
                        style={{ height: `${Math.max(heightPercent, 1.5)}%` }}
                        className={`w-3/5 max-w-6 rounded-t-[4px] transition-colors duration-150 ${
                          column.dimmed
                            ? "bg-sand group-hover:bg-accent-fill"
                            : "bg-accent group-hover:bg-ink"
                        }`}
                      />
                    ) : null}

                    {index === peakIndex ? (
                      <span
                        style={{ bottom: `${Math.max(heightPercent, 1.5)}%` }}
                        className="pointer-events-none absolute mb-1 whitespace-nowrap text-2xs font-medium tabular-nums text-ink group-hover:opacity-0"
                      >
                        {formatPaiseCompact(column.paise)}
                      </span>
                    ) : null}

                    <span
                      role="presentation"
                      style={{ bottom: `${Math.max(heightPercent, 1.5)}%` }}
                      className={`pointer-events-none absolute z-10 mb-1.5 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-2xs text-canvas opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
                        // Keep the readout inside the card at either edge.
                        index < 2
                          ? "left-0"
                          : index > columns.length - 3
                            ? "right-0"
                            : ""
                      }`}
                    >
                      {longMonth.format(monthDate(column.month))} ·{" "}
                      <span className="font-medium tabular-nums">
                        {formatPaise(column.paise)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-1.5 flex">
            {columns.map((column) => (
              <span
                key={column.month}
                className="flex-1 text-center text-2xs text-ink-muted"
              >
                {/* Twelve three-letter names collide on a phone; one letter
                    each fits, and the tooltip and table name the month in full. */}
                <span className="sm:hidden">
                  {shortMonth.format(monthDate(column.month)).slice(0, 1)}
                </span>
                <span className="max-sm:hidden">
                  {shortMonth.format(monthDate(column.month))}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{valueLabel} by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.month}>
              <th scope="row">{longMonth.format(monthDate(column.month))}</th>
              <td>{formatPaise(column.paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
