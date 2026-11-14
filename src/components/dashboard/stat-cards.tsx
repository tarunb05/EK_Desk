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

  // Each tile is a flat colour block from the palette rather than six
  // identical white cards -- the block itself is what tells the figures
  // apart at a glance. `block` is the fill, `label` the caption/icon colour
  // and `figure` the number; every pairing below clears 4.5:1 (label) on
  // its own fill, which is why the collected tile's figure is plain --ink
  // rather than --positive (3:1 on periwinkle). Meaning never rides on the
  // colour alone: each tile also has its label and its own icon.
  const cards: {
    testId: string;
    label: string;
    value: string;
    block: string;
    labelTone: string;
    figure: string;
    Icon: ComponentType<{ size?: number }>;
    exportHref?: string;
  }[] = [
    {
      testId: "students-enrolled",
      label: "Students enrolled",
      value: String(summary.studentCount),
      block: "bg-surface",
      labelTone: "text-ink-muted",
      figure: "text-ink",
      Icon: StudentsIcon,
    },
    {
      testId: "total-receivable",
      label: "Total receivable",
      value: formatPaise(summary.totalReceivablePaise),
      block: "bg-sand",
      labelTone: "text-ink-secondary",
      figure: "text-ink",
      Icon: WalletIcon,
      exportHref: exportHref("receivable"),
    },
    {
      testId: "total-collected",
      label: "Total collected",
      value: collectedFiguresUnavailable
        ? "No results found."
        : formatPaise(summary.totalCollectedPaise),
      block: "bg-accent-fill",
      labelTone: "text-ink",
      figure: "text-ink",
      Icon: StatusIcon,
      exportHref: exportHref("collected"),
    },
    {
      testId: "total-pending",
      label: "Total pending",
      value: formatPaise(summary.totalPendingPaise),
      block: "bg-surface",
      labelTone: "text-ink-muted",
      figure: "text-attention",
      Icon: ClockIcon,
      exportHref: exportHref("pending"),
    },
    {
      testId: "total-overdue",
      label: "Total overdue",
      value: formatPaise(summary.totalOverduePaise),
      block: "bg-attention-fill",
      labelTone: "text-attention",
      figure: "text-attention",
      Icon: AlertIcon,
      exportHref: exportHref("overdue"),
    },
    {
      testId: "collection-rate",
      label: "Collection rate",
      value: collectedFiguresUnavailable
        ? "No results found."
        : `${rate.toFixed(1)}%`,
      block: "bg-accent",
      labelTone: "text-canvas",
      figure: "text-canvas",
      Icon: TrendIcon,
    },
  ];

  return (
    <div className="stagger-in grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        // Only the four export cards are actually clickable (they download
        // an Excel file) -- a hover effect on the plain divs would be a
        // false affordance. Scale, not translate/shadow: same "give it a
        // little weight" idea as the category-breakdown bars' hover grow,
        // for the same reason -- these numbers aren't a dimension anything
        // else encodes, so growing them slightly can't misrepresent data.
        const cardClassName = `flex min-h-28 flex-col justify-between gap-4 rounded-lg p-4 ${card.block} ${
          card.exportHref
            ? "transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            : ""
        }`;
        const content = (
          <>
            <div
              className={`flex items-start justify-between gap-2 ${card.labelTone}`}
            >
              {/* Wraps to a second line on a narrow tile rather than
                  truncating -- "Total receivab…" hides the one word that
                  tells this tile from its neighbours. */}
              <span className="min-w-0 flex-1 text-2xs font-medium uppercase leading-tight tracking-[0.06em]">
                {card.label}
              </span>
              <card.Icon size={15} />
            </div>
            <div
              data-testid={card.testId}
              className={
                card.value === "No results found."
                  ? `text-sm ${card.labelTone}`
                  : `text-2xl font-semibold leading-none tracking-[-0.02em] tabular-nums ${card.figure}`
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
