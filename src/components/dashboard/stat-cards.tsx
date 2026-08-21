import { formatPaise } from "@/lib/domain/money";
import { collectionRate } from "@/lib/domain/collection-rate";
import type { DashboardSummary } from "@/lib/records/dashboard-queries";

interface StatCardsProps {
  summary: DashboardSummary;
  // True when the month filter's selected month(s) have no recorded
  // collections at all — shown as a sentence instead of a misleading ₹0 /
  // 0.0%, since a real zero and "no data yet" read the same otherwise.
  // Only Total collected / Collection rate are month-scoped, so only those
  // two cards are affected.
  collectedFiguresUnavailable?: boolean;
}

export function StatCards({
  summary,
  collectedFiguresUnavailable = false,
}: StatCardsProps) {
  const rate = collectionRate(
    summary.totalReceivablePaise,
    summary.totalCollectedPaise,
  );

  const cards: {
    testId: string;
    label: string;
    value: string;
    tone?: "positive" | "attention";
  }[] = [
    {
      testId: "students-enrolled",
      label: "Students enrolled",
      value: String(summary.studentCount),
    },
    {
      testId: "total-receivable",
      label: "Total receivable",
      value: formatPaise(summary.totalReceivablePaise),
    },
    {
      testId: "total-collected",
      label: "Total collected",
      value: collectedFiguresUnavailable
        ? "No results found."
        : formatPaise(summary.totalCollectedPaise),
      tone: "positive",
    },
    {
      testId: "total-pending",
      label: "Total pending",
      value: formatPaise(summary.totalPendingPaise),
      tone: "attention",
    },
    {
      testId: "total-overdue",
      label: "Total overdue",
      value: formatPaise(summary.totalOverduePaise),
      tone: "attention",
    },
    {
      testId: "collection-rate",
      label: "Collection rate",
      value: collectedFiguresUnavailable
        ? "No results found."
        : `${rate.toFixed(1)}%`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-md border border-hairline bg-surface p-4"
        >
          <div className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            {card.label}
          </div>
          <div
            data-testid={card.testId}
            className={
              card.value === "No results found."
                ? "mt-1 text-sm text-ink-muted"
                : `mt-1 text-xl tabular-nums ${
                    card.tone === "positive"
                      ? "text-positive"
                      : card.tone === "attention"
                        ? "text-attention"
                        : "text-ink"
                  }`
            }
          >
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
