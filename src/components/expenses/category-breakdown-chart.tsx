import { formatPaise } from "@/lib/domain/money";
import type { ExpenseCategoryBreakdownRow } from "@/lib/records/expense-directory";

// Horizontal bar list, not a pie -- ten categories in a pie is unreadable
// and the office will compare two of them. A single flat fill on every
// bar: there's no categorical-identity problem to solve here, each bar's
// identity is already given by its row label, not by color. Bar width is
// relative to the largest category (standard bar-chart convention, more
// legible for the smaller categories than scaling to the total would be)
// -- the label states percent-of-total directly instead.
export function CategoryBreakdownChart({
  rows,
  totalPaise,
}: {
  rows: ExpenseCategoryBreakdownRow[];
  totalPaise: bigint;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No expenses recorded in this scope yet — the breakdown appears once
        one is.
      </p>
    );
  }

  const maxPaise = rows[0]!.amountPaise;

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
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
          <div
            key={row.categoryId}
            className="flex items-center gap-3"
            title={`${row.categoryName}: ${formattedAmount} (${formattedShare}%)`}
          >
            <span className="w-32 shrink-0 truncate text-sm text-ink-secondary">
              {row.categoryName}
            </span>
            <div className="h-6 flex-1 rounded-md bg-canvas">
              <div
                className="h-6 rounded-md bg-accent-fill"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <span className="w-36 shrink-0 text-right text-sm tabular-nums text-ink">
              {formattedAmount} · {formattedShare}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
