import { formatPaise } from "@/lib/domain/money";
import { ChartCard, ChartEmpty, ChartLegend } from "./chart-card";

// One bar for the whole receivable, split three ways: what has come in,
// what is still owed but not late, and what is late. The stat tiles above
// give the same amounts as separate numbers; this is the one place they are
// shown as parts of a single whole, which is the question the office
// actually asks ("how much of it have we got?").
//
// "Pending" in the summary includes overdue, so the middle part is
// pending minus overdue -- otherwise the three parts would add up to more
// than the receivable.
export function CollectionProgress({
  receivablePaise,
  collectedPaise,
  pendingPaise,
  overduePaise,
  caption,
}: {
  receivablePaise: bigint;
  collectedPaise: bigint;
  pendingPaise: bigint;
  overduePaise: bigint;
  caption?: string;
}) {
  const notYetDuePaise =
    pendingPaise > overduePaise ? pendingPaise - overduePaise : 0n;

  // Shares are of the three parts' own sum rather than of receivable: an
  // overpaid account can push collected past receivable, and the bar still
  // has to add up to exactly 100%.
  const total = collectedPaise + notYetDuePaise + overduePaise;

  const parts = [
    {
      label: "Collected",
      paise: collectedPaise,
      block: "bg-accent",
      text: "text-canvas",
    },
    {
      label: "Pending, not yet due",
      paise: notYetDuePaise,
      block: "bg-accent-fill",
      text: "text-ink",
    },
    {
      label: "Overdue",
      paise: overduePaise,
      block: "bg-attention",
      text: "text-surface",
    },
  ].map((part) => ({
    ...part,
    share: total > 0n ? (Number(part.paise) / Number(total)) * 100 : 0,
  }));

  return (
    <ChartCard title="Where the receivable stands" caption={caption}>
      {receivablePaise === 0n || total === 0n ? (
        <ChartEmpty>
          No fees are set up in this scope yet. Add a student to start tracking
          what&apos;s collected.
        </ChartEmpty>
      ) : (
        <>
          <div
            role="img"
            aria-label={parts
              .map(
                (part) =>
                  `${part.label} ${formatPaise(part.paise)}, ${part.share.toFixed(1)}%`,
              )
              .join("; ")}
            className="flex h-7 w-full gap-0.5"
          >
            {parts.map((part) =>
              part.paise > 0n ? (
                <div
                  key={part.label}
                  title={`${part.label}: ${formatPaise(part.paise)} (${part.share.toFixed(1)}%)`}
                  style={{ width: `${part.share}%` }}
                  className={`flex min-w-1 items-center rounded-[4px] px-2 ${part.block} ${part.text}`}
                >
                  {/* Printed only when the block is wide enough to hold it
                      with padding -- a narrow part's share stays in the
                      legend below rather than being clipped. */}
                  {part.share >= 9 ? (
                    <span
                      className={`text-xs font-medium tabular-nums ${part.share < 16 ? "max-sm:hidden" : ""}`}
                    >
                      {part.share.toFixed(1)}%
                    </span>
                  ) : null}
                </div>
              ) : null,
            )}
          </div>
          <ChartLegend
            items={parts.map((part) => ({
              label: part.label,
              swatch: part.block,
              detail: formatPaise(part.paise),
            }))}
          />
        </>
      )}
    </ChartCard>
  );
}
