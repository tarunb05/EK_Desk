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
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="h-9 border-b border-hairline bg-canvas text-2xs font-medium uppercase tracking-wide text-ink-muted">
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
              className="h-9 border-b border-hairline last:border-0"
            >
              <td className="px-3 text-ink">{branch.name}</td>
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
              <td className="px-3 text-right tabular-nums">
                {collectionRate(
                  summary.totalReceivablePaise,
                  summary.totalCollectedPaise,
                ).toFixed(1)}
                %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
