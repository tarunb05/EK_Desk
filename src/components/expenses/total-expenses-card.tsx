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
      // Same tile box as the dashboards' StatCards, on the slate block --
      // this page has one headline figure, so it gets the heaviest colour.
      className="flex min-h-28 w-full flex-col justify-between gap-4 rounded-lg bg-accent p-4 text-canvas transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-[0.06em]">
          Total expenses
        </span>
        <WalletIcon size={15} />
      </div>
      <div>
        <div className="text-2xl font-semibold leading-none tracking-[-0.02em] tabular-nums">
          {formatPaise(totalPaise)}
        </div>
        <div className="mt-2 text-xs">{caption}</div>
      </div>
    </a>
  );
}
