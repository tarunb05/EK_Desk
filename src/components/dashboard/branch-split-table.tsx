import { formatPaise } from "@/lib/domain/money";
import { collectionRate } from "@/lib/domain/collection-rate";
import type { DashboardSummary } from "@/lib/records/dashboard-queries";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";

export interface BranchSplitRow {
  branch: BranchOption;
  summary: DashboardSummary;
}

export function BranchSplitTable({ rows }: { rows: BranchSplitRow[] }) {
  return (
    <div className="scroll-reveal overflow-x-auto rounded-lg border border-hairline bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="h-9 border-b border-hairline bg-sand/50 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            <th className="px-3 text-left">Branch</th>
            <th className="px-3 text-right">Students</th>
            <th className="px-3 text-right">Receivable</th>
            <th className="px-3 text-right">Collected</th>
            <th className="px-3 text-right">Pending</th>
            <th className="px-3 text-right">Overdue</th>
            <th className="px-3 text-right">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ branch, summary }) => (
            <tr
              key={branch.id}
              className="h-9 border-b border-hairline even:bg-canvas/50 transition-colors last:border-0 hover:bg-surface-accent"
            >
              <td className="whitespace-nowrap px-3 text-ink">{branch.name}</td>
              <td className="px-3 text-right tabular-nums">
                {summary.studentCount}
              </td>
              <td className="px-3 text-right tabular-nums">
                {formatPaise(summary.totalReceivablePaise)}
              </td>
              <td className="px-3 text-right tabular-nums text-positive">
                {formatPaise(summary.totalCollectedPaise)}
              </td>
              <td className="px-3 text-right tabular-nums text-attention">
                {formatPaise(summary.totalPendingPaise)}
              </td>
              <td className="px-3 text-right tabular-nums text-attention">
                {formatPaise(summary.totalOverduePaise)}
              </td>
              <td className="px-3">
                {/* The rate as a short meter beside the number, so two
                    branches can be compared down the column at a glance. */}
                <RateMeter
                  rate={collectionRate(
                    summary.totalReceivablePaise,
                    summary.totalCollectedPaise,
                  )}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RateMeter({ rate }: { rate: number }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span
        aria-hidden="true"
        className="h-1.5 w-16 overflow-hidden rounded-full bg-sand max-sm:hidden"
      >
        <span
          style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
          className="block h-full rounded-full bg-accent"
        />
      </span>
      <span className="w-12 text-right tabular-nums">{rate.toFixed(1)}%</span>
    </span>
  );
}
