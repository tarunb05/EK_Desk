import { formatPaise } from "@/lib/domain/money";
import { WalletIcon } from "@/components/shell/nav-icons";

// Reuses StatCards' exact card shell for a single figure rather than
// pulling in the whole 6-card grid component for a figure that doesn't
// fit its fixed card set.
export function TotalExpensesCard({ totalPaise }: { totalPaise: bigint }) {
  return (
    <div className="w-full max-w-xs rounded-md border border-hairline bg-surface p-4 transition-colors hover:border-border">
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
    </div>
  );
}
