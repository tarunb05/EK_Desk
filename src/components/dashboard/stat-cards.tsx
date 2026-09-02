import { formatPaise } from "@/lib/domain/money";
import { collectionRate } from "@/lib/domain/collection-rate";
import type { DashboardSummary } from "@/lib/records/dashboard-queries";
import type { FeeAccountExportMetric } from "@/lib/records/queries";
import type { ServiceType } from "@/lib/records/types";
import {
  AlertIcon,
  ClockIcon,
  StatusIcon,
  StudentsIcon,
  TrendIcon,
  WalletIcon,
} from "@/components/shell/nav-icons";
import type { ComponentType } from "react";

interface StatCardsProps {
  summary: DashboardSummary;
  // True when the month filter's selected month(s) have no recorded
  // collections at all — shown as a sentence instead of a misleading ₹0 /
  // 0.0%, since a real zero and "no data yet" read the same otherwise.
  // Only Total collected / Collection rate are month-scoped, so only those
  // two cards are affected.
  collectedFiguresUnavailable?: boolean;
  // Present only on the two dashboards (Transport/Daycare) -- the four
  // money cards download an Excel export of exactly the students behind
  // that figure when this is set; Students enrolled/Collection rate never
  // export (there's no single-column record either one corresponds to).
  exportScope?: {
    serviceType: ServiceType;
    academicYearId: string;
    branch: string;
  };
}

export function StatCards({
  summary,
  collectedFiguresUnavailable = false,
  exportScope,
}: StatCardsProps) {
  const rate = collectionRate(
    summary.totalReceivablePaise,
    summary.totalCollectedPaise,
  );

  function exportHref(metric: FeeAccountExportMetric): string | undefined {
    if (!exportScope) return undefined;
    const params = new URLSearchParams({
      service: exportScope.serviceType,
      metric,
      year: exportScope.academicYearId,
      branch: exportScope.branch,
    });
    return `/api/export/fee-accounts?${params.toString()}`;
  }

  const cards: {
    testId: string;
    label: string;
    value: string;
    tone?: "positive" | "attention";
    Icon: ComponentType<{ size?: number }>;
    exportHref?: string;
  }[] = [
    {
      testId: "students-enrolled",
      label: "Students enrolled",
      value: String(summary.studentCount),
      Icon: StudentsIcon,
    },
    {
      testId: "total-receivable",
      label: "Total receivable",
      value: formatPaise(summary.totalReceivablePaise),
      Icon: WalletIcon,
      exportHref: exportHref("receivable"),
    },
    {
      testId: "total-collected",
      label: "Total collected",
      value: collectedFiguresUnavailable
        ? "No results found."
        : formatPaise(summary.totalCollectedPaise),
      tone: "positive",
      Icon: StatusIcon,
      exportHref: exportHref("collected"),
    },
    {
      testId: "total-pending",
      label: "Total pending",
      value: formatPaise(summary.totalPendingPaise),
      tone: "attention",
      Icon: ClockIcon,
      exportHref: exportHref("pending"),
    },
    {
      testId: "total-overdue",
      label: "Total overdue",
      value: formatPaise(summary.totalOverduePaise),
      tone: "attention",
      Icon: AlertIcon,
      exportHref: exportHref("overdue"),
    },
    {
      testId: "collection-rate",
      label: "Collection rate",
      value: collectedFiguresUnavailable
        ? "No results found."
        : `${rate.toFixed(1)}%`,
      Icon: TrendIcon,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => {
        // Only the four export cards are actually clickable (they download
        // an Excel file) -- a hover effect on the plain divs would be a
        // false affordance. Scale, not translate/shadow: same "give it a
        // little weight" idea as the category-breakdown bars' hover grow,
        // for the same reason -- these numbers aren't a dimension anything
        // else encodes, so growing them slightly can't misrepresent data.
        const cardClassName = card.exportHref
          ? "rounded-md border border-hairline bg-surface p-4 transition-[border-color,transform] duration-150 hover:scale-[1.03] hover:border-accent active:scale-[0.98]"
          : "rounded-md border border-hairline bg-surface p-4";
        const content = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-2xs font-medium uppercase tracking-wide text-ink-muted">
                {card.label}
              </span>
              <span
                className={
                  "shrink-0 " +
                  (card.tone === "positive"
                    ? "text-positive-fill"
                    : card.tone === "attention"
                      ? "text-attention"
                      : "text-ink-muted")
                }
              >
                <card.Icon size={15} />
              </span>
            </div>
            <div
              data-testid={card.testId}
              className={
                card.value === "No results found."
                  ? "mt-2 text-sm text-ink-muted"
                  : `mt-2 text-xl font-medium tabular-nums ${
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
          </>
        );

        return card.exportHref ? (
          <a
            key={card.label}
            href={card.exportHref}
            title={`Download ${card.label.toLowerCase()} as Excel`}
            className={cardClassName}
          >
            {content}
          </a>
        ) : (
          <div key={card.label} className={cardClassName}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
