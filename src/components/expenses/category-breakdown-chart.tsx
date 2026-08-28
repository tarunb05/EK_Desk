import { formatPaise } from "@/lib/domain/money";
import type { ExpenseCategoryBreakdownRow } from "@/lib/records/expense-directory";

// Horizontal bar list, not a pie -- ten categories in a pie is unreadable
// and the office will compare two of them (confirmed against the dataviz
// skill's own rules too: part-to-whole defaults to a bar chart, and a
// donut/pie is explicitly called out as wrong past ~6 segments). Bar width
// is relative to the largest category (standard bar-chart convention, more
// legible for the smaller categories than scaling to the total would be)
// -- the label states percent-of-total directly instead.
//
// Colors alternate --accent/--accent-fill by row position, not by category
// identity -- identity is still the row label, same as before. This is
// scannability striping (like a zebra table), not categorical encoding, so
// it doesn't run into "color follows the entity, never its rank": no
// entity's identity is being color-coded here, alternating or not.
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
    <div className="category-breakdown flex flex-col gap-2">
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
          <div
            key={row.categoryId}
            className="category-breakdown-row flex items-center gap-3"
            title={`${row.categoryName}: ${formattedAmount} (${formattedShare}%)`}
          >
            <span className="w-32 shrink-0 truncate text-sm text-ink-secondary">
              {row.categoryName}
            </span>
            <div className="h-6 flex-1 rounded-md bg-canvas">
              <div
                className={`animate-bar-grow-in h-6 rounded-md ${
                  index % 2 === 0 ? "bg-accent" : "bg-accent-fill"
                }`}
                style={{
                  width: `${widthPercent}%`,
                  animationDelay: `${index * 40}ms`,
                }}
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
