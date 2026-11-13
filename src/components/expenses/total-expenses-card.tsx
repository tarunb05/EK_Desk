import { formatPaise } from "@/lib/domain/money";
import { WalletIcon } from "@/components/shell/nav-icons";

// Reuses StatCards' exact card shell for a single figure rather than
// pulling in the whole 6-card grid component for a figure that doesn't
// fit its fixed card set.
//
// The figure follows every active filter, and `caption` says which ones, so
// a month's total never reads like the whole year's. The Excel link carries
// the same filters, so the file holds the rows this figure adds up.
export function TotalExpensesCard({
  totalPaise,
  caption,
  exportHref,
}: {
  totalPaise: bigint;
  caption: string;
  exportHref: string;
}) {
  return (
    <a
      href={exportHref}
      title="Download these expenses as Excel"
      className="w-full max-w-xs rounded-md border border-hairline bg-surface p-4 transition-[border-color,transform] duration-150 hover:scale-[1.03] hover:border-accent active:scale-[0.98]"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Total expenses
        </span>
        <span className="text-ink-muted">
          <WalletIcon size={15} />
        </span>
      </div>
      <div className="mt-2 text-xl font-medium tabular-nums text-ink">
        {formatPaise(totalPaise)}
      </div>
      <div className="mt-1 text-xs text-ink-secondary">{caption}</div>
    </a>
  );
}
