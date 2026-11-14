import { formatPaise } from "@/lib/domain/money";
import type { ExpenseCategoryBreakdownRow } from "@/lib/records/expense-directory";
import { ChartEmpty, ChartLegend } from "@/components/charts/chart-card";

// Horizontal bar list, not a pie -- ten categories in a pie is unreadable
// and the office will compare two of them. Bar length is relative to the
// largest category (standard bar-chart convention, more legible for the
// smaller categories than scaling to the total would be); the label states
// percent-of-total directly instead.
//
// The same rule as the Transport and Daycare dashboards: the chart keeps
// the whole year in view and the filters pick part of it out. Each bar is
// that category's spend for the year (with the method and search filters
// applied); the part inside the filtered selection -- month or date range,
// and the category if one is picked -- is slate, the rest of the year sand.
// With no narrowing filter the two are the same and every bar is all slate.
// The amount and percentage beside each bar are the selection's, so they
// add up to the Total expenses card above.
//
// The grid sits on the list and each row is display:contents, so the name,
// bar and amount columns are sized once for all rows and every bar starts
// at the same x.
export function CategoryBreakdownChart({
  yearRows,
  selectedRows,
  selectedTotalPaise,
  filtered,
  year,
}: {
  // Every category spent on in the year, largest first.
  yearRows: ExpenseCategoryBreakdownRow[];
  // The same categories, restricted to the filtered selection.
  selectedRows: ExpenseCategoryBreakdownRow[];
  selectedTotalPaise: bigint;
  // True when a month, date range or category narrows the selection.
  filtered: boolean;
  year: string;
}) {
  if (yearRows.length === 0) {
    return (
      <ChartEmpty>
        No expenses recorded in this scope yet. The breakdown appears once one
        is.
      </ChartEmpty>
    );
  }

  const selectedById = new Map(
    selectedRows.map((row) => [row.categoryId, row.amountPaise]),
  );
  const maxPaise = yearRows[0]!.amountPaise;

  return (
    <div className="flex flex-col gap-4">
      <ul className="category-breakdown grid grid-cols-[minmax(0,9rem)_minmax(3rem,1fr)_auto] items-center gap-x-3 gap-y-3">
        {yearRows.map((row, index) => {
          const selectedPaise = selectedById.get(row.categoryId) ?? 0n;
          const widthPercent = Math.max(
            2,
            (Number(row.amountPaise) / Number(maxPaise)) * 100,
          );
          // Of this bar, how much is the selection.
          const selectedPercent =
            row.amountPaise > 0n
              ? Math.min(
                  100,
                  (Number(selectedPaise) / Number(row.amountPaise)) * 100,
                )
              : 0;
          const sharePercent =
            selectedTotalPaise > 0n
              ? (Number(selectedPaise) / Number(selectedTotalPaise)) * 100
              : 0;
          const formattedAmount = formatPaise(selectedPaise);
          const formattedShare = sharePercent.toFixed(1);

          return (
            <li
              key={row.categoryId}
              className="category-breakdown-row contents"
              title={
                filtered
                  ? `${row.categoryName}: ${formattedAmount} in the selection (${formattedShare}%), ${formatPaise(row.amountPaise)} in ${year}`
                  : `${row.categoryName}: ${formattedAmount} (${formattedShare}%)`
              }
            >
              <span
                className={`truncate text-sm ${selectedPaise > 0n ? "text-ink" : "text-ink-muted"}`}
              >
                {row.categoryName}
              </span>
              <div className="h-2.5 rounded-full bg-canvas">
                <div
                  className="animate-bar-grow-in flex h-2.5 gap-0.5"
                  style={{
                    width: `${widthPercent}%`,
                    animationDelay: `${index * 40}ms`,
                  }}
                >
                  {selectedPercent > 0 ? (
                    <div
                      className="h-full min-w-0.5 rounded-full bg-accent"
                      style={{ width: `${selectedPercent}%` }}
                    />
                  ) : null}
                  {selectedPercent < 100 ? (
                    <div className="h-full min-w-0.5 flex-1 rounded-full bg-sand" />
                  ) : null}
                </div>
              </div>
              <span
                className={`whitespace-nowrap text-right text-sm tabular-nums ${selectedPaise > 0n ? "text-ink" : "text-ink-muted"}`}
              >
                {formattedAmount}
                <span className="ml-2 inline-block w-11 text-xs text-ink-muted">
                  {formattedShare}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {filtered ? (
        <ChartLegend
          items={[
            { label: "In the selection", swatch: "bg-accent" },
            { label: `Rest of ${year}`, swatch: "bg-sand" },
          ]}
        />
      ) : null}
    </div>
  );
}
