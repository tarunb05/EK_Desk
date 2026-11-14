import { formatPaise } from "@/lib/domain/money";
import type { ExpenseCategoryBreakdownRow } from "@/lib/records/expense-directory";
import { ChartEmpty } from "@/components/charts/chart-card";

// Horizontal bar list, not a pie -- ten categories in a pie is unreadable
// and the office will compare two of them. Bar length is relative to the
// largest category (standard bar-chart convention, more legible for the
// smaller categories than scaling to the total would be); the label states
// percent-of-total directly instead.
//
// One colour for every bar: the bars are one series (spend), told apart by
// the name beside each, so a second colour would encode nothing. Thin bars
// on a canvas-coloured track, the same mark the dashboards' breakdowns use.
//
// The grid sits on the list and each row is display:contents, so the name,
// bar and amount columns are sized once for all rows and every bar starts
// at the same x.
export function CategoryBreakdownChart({
  rows,
  totalPaise,
}: {
  rows: ExpenseCategoryBreakdownRow[];
  totalPaise: bigint;
}) {
  if (rows.length === 0) {
    return (
      <ChartEmpty>
        No expenses recorded in this scope yet. The breakdown appears once one
        is.
      </ChartEmpty>
    );
  }

  const maxPaise = rows[0]!.amountPaise;

  return (
    <ul className="category-breakdown grid grid-cols-[minmax(0,9rem)_minmax(3rem,1fr)_auto] items-center gap-x-3 gap-y-3">
      {rows.map((row, index) => {
        const widthPercent = Math.max(
          2,
          (Number(row.amountPaise) / Number(maxPaise)) * 100,
        );
        const sharePercent =
          totalPaise > 0n
            ? (Number(row.amountPaise) / Number(totalPaise)) * 100
            : 0;
        const formattedAmount = formatPaise(row.amountPaise);
        const formattedShare = sharePercent.toFixed(1);

        return (
          <li
            key={row.categoryId}
            className="category-breakdown-row contents"
            title={`${row.categoryName}: ${formattedAmount} (${formattedShare}%)`}
          >
            <span className="truncate text-sm text-ink">
              {row.categoryName}
            </span>
            <div className="h-2.5 rounded-full bg-canvas">
              <div
                className="animate-bar-grow-in h-2.5 rounded-full bg-accent"
                style={{
                  width: `${widthPercent}%`,
                  animationDelay: `${index * 40}ms`,
                }}
              />
            </div>
            <span className="whitespace-nowrap text-right text-sm tabular-nums text-ink">
              {formattedAmount}
              <span className="ml-2 inline-block w-11 text-xs text-ink-muted">
                {formattedShare}%
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
