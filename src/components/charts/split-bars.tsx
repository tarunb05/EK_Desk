import { formatPaise } from "@/lib/domain/money";
import { collectionRate } from "@/lib/domain/collection-rate";
import type { CollectionBreakdownRow } from "@/lib/records/dashboard-queries";
import { ChartEmpty, ChartLegend } from "./chart-card";

const MAX_ROWS = 8;

// One row per class (or route, or daycare slot): a thin bar whose length is
// that group's receivable relative to the largest group, split into what
// has been collected and what is still pending. Length compares the groups
// with each other; the split shows how each one is doing; the rate on the
// right says it as a number.
//
// Largest receivable first. Past eight rows the tail is folded into one
// "Other" row rather than drawn -- a ninth and tenth sliver of bar tells
// nobody anything, and the Students page lists every one of them anyway.
export function SplitBars({
  rows,
  emptyText,
}: {
  rows: CollectionBreakdownRow[];
  emptyText: string;
}) {
  const sorted = [...rows]
    .filter((row) => row.receivablePaise > 0n)
    .sort((a, b) =>
      a.receivablePaise === b.receivablePaise
        ? a.label.localeCompare(b.label)
        : a.receivablePaise > b.receivablePaise
          ? -1
          : 1,
    );

  if (sorted.length === 0) {
    return <ChartEmpty>{emptyText}</ChartEmpty>;
  }

  const shown =
    sorted.length > MAX_ROWS ? sorted.slice(0, MAX_ROWS - 1) : sorted;
  const folded = sorted.slice(shown.length);
  const display: CollectionBreakdownRow[] =
    folded.length > 0
      ? [
          ...shown,
          folded.reduce<CollectionBreakdownRow>(
            (sum, row) => ({
              label: sum.label,
              studentCount: sum.studentCount + row.studentCount,
              receivablePaise: sum.receivablePaise + row.receivablePaise,
              collectedPaise: sum.collectedPaise + row.collectedPaise,
              pendingPaise: sum.pendingPaise + row.pendingPaise,
            }),
            {
              label: `Other (${folded.length})`,
              studentCount: 0,
              receivablePaise: 0n,
              collectedPaise: 0n,
              pendingPaise: 0n,
            },
          ),
        ]
      : shown;

  const maxReceivable = display.reduce(
    (m, row) => (row.receivablePaise > m ? row.receivablePaise : m),
    0n,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The grid is on the list and each row is display:contents, so the
          three columns are sized once for all rows -- every bar starts at
          the same x no matter how long that row's label or amounts are. */}
      <ul className="grid grid-cols-[minmax(0,9rem)_minmax(3rem,1fr)_auto] items-center gap-x-3 gap-y-3">
        {display.map((row) => {
          const lengthPercent =
            (Number(row.receivablePaise) / Number(maxReceivable)) * 100;
          const collectedPercent = Math.min(
            100,
            (Number(row.collectedPaise) / Number(row.receivablePaise)) * 100,
          );
          const rate = collectionRate(row.receivablePaise, row.collectedPaise);
          return (
            <li
              key={row.label}
              title={`${row.label}: ${formatPaise(row.collectedPaise)} collected of ${formatPaise(row.receivablePaise)}, ${formatPaise(row.pendingPaise)} pending`}
              className="contents"
            >
              <span className="truncate text-sm text-ink">{row.label}</span>
              <div className="h-2.5">
                <div
                  style={{ width: `${Math.max(lengthPercent, 3)}%` }}
                  className="flex h-full gap-0.5"
                >
                  {collectedPercent > 0 ? (
                    <div
                      style={{ width: `${collectedPercent}%` }}
                      className="h-full min-w-0.5 rounded-full bg-accent"
                    />
                  ) : null}
                  {collectedPercent < 100 ? (
                    <div className="h-full min-w-0.5 flex-1 rounded-full bg-accent-fill" />
                  ) : null}
                </div>
              </div>
              <span className="whitespace-nowrap text-right text-sm tabular-nums text-ink">
                {rate.toFixed(0)}%
                <span className="ml-2 text-xs text-ink-muted max-sm:hidden">
                  {formatPaise(row.collectedPaise)} of{" "}
                  {formatPaise(row.receivablePaise)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <ChartLegend
        items={[
          { label: "Collected", swatch: "bg-accent" },
          { label: "Pending", swatch: "bg-accent-fill" },
        ]}
      />
    </div>
  );
}
