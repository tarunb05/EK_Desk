import { formatPaise } from "@/lib/domain/money";
import { ChartCard } from "@/components/charts/chart-card";
import { CollectionProgress } from "@/components/charts/collection-progress";
import { MonthColumns } from "@/components/charts/month-columns";
import { AgeingBars } from "@/components/charts/ageing-bars";
import { SplitBars } from "@/components/charts/split-bars";

// The landing page's "this is what you get" panel. Not a screenshot and not
// a mock-up: these are the very components the Transport and Daycare
// dashboards render, fed a small set of made-up figures instead of a
// database query. So the panel can never drift from the real product the
// way a saved image does -- restyle a chart and this changes with it.
//
// Every number below is invented for the illustration (and labelled as
// sample figures on the page). They are chosen to add up: collected +
// pending = receivable, the ageing buckets sum to pending, and the monthly
// columns sum to collected -- a preview whose own numbers disagree would
// undercut the one thing it is here to show.
const RECEIVABLE = 84_600_000n;
const COLLECTED = 51_300_000n;
const PENDING = RECEIVABLE - COLLECTED;
const OVERDUE = 14_800_000n;

const MONTHS: [string, bigint][] = [
  ["2026-04", 9_400_000n],
  ["2026-05", 6_100_000n],
  ["2026-06", 11_200_000n],
  ["2026-07", 7_300_000n],
  ["2026-08", 4_900_000n],
  ["2026-09", 5_600_000n],
  ["2026-10", 3_700_000n],
  ["2026-11", 3_100_000n],
  ["2026-12", 0n],
  ["2027-01", 0n],
  ["2027-02", 0n],
  ["2027-03", 0n],
];

const TILES: { label: string; value: string; block: string; text: string }[] = [
  {
    label: "Students enrolled",
    value: "118",
    block: "bg-surface",
    text: "text-ink",
  },
  {
    label: "Total receivable",
    value: formatPaise(RECEIVABLE),
    block: "bg-sand",
    text: "text-ink",
  },
  {
    label: "Total collected",
    value: formatPaise(COLLECTED),
    block: "bg-accent-fill",
    text: "text-ink",
  },
  {
    label: "Collection rate",
    value: "60.6%",
    block: "bg-accent",
    text: "text-canvas",
  },
];

export function LandingPreview() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-canvas p-3 md:gap-4 md:p-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((tile) => (
          <div
            key={tile.label}
            className={`flex min-h-24 flex-col justify-between gap-3 rounded-lg p-4 ${tile.block} ${tile.text}`}
          >
            <span className="text-2xs font-medium uppercase leading-tight tracking-[0.06em]">
              {tile.label}
            </span>
            <span className="text-2xl font-semibold leading-none tracking-[-0.02em] tabular-nums">
              {tile.value}
            </span>
          </div>
        ))}
      </div>

      <CollectionProgress
        receivablePaise={RECEIVABLE}
        collectedPaise={COLLECTED}
        pendingPaise={PENDING}
        overduePaise={OVERDUE}
        caption="Whole year, as of today"
      />

      <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
        <ChartCard
          title="Collected each month"
          caption="By the date the payment was made"
          className="lg:col-span-2"
        >
          <MonthColumns
            columns={MONTHS.map(([month, paise]) => ({ month, paise }))}
            valueLabel="Collected"
            emptyText=""
          />
        </ChartCard>
        <ChartCard title="How old the pending is" caption="By due date">
          <AgeingBars
            buckets={[
              {
                bucket: "not_yet_due",
                accountCount: 41,
                pendingPaise: PENDING - OVERDUE,
              },
              { bucket: "1-30", accountCount: 12, pendingPaise: 6_200_000n },
              { bucket: "31-60", accountCount: 7, pendingPaise: 4_900_000n },
              { bucket: "60+", accountCount: 5, pendingPaise: 3_700_000n },
            ]}
          />
        </ChartCard>
      </div>

      <ChartCard title="By class" caption="Share of fees collected">
        <SplitBars
          emptyText=""
          rows={[
            {
              label: "Nursery",
              studentCount: 34,
              receivablePaise: 26_400_000n,
              collectedPaise: 17_900_000n,
              pendingPaise: 8_500_000n,
            },
            {
              label: "Play Group",
              studentCount: 29,
              receivablePaise: 21_800_000n,
              collectedPaise: 11_600_000n,
              pendingPaise: 10_200_000n,
            },
            {
              label: "Euro Junior",
              studentCount: 31,
              receivablePaise: 20_100_000n,
              collectedPaise: 13_400_000n,
              pendingPaise: 6_700_000n,
            },
            {
              label: "Euro Senior",
              studentCount: 24,
              receivablePaise: 16_300_000n,
              collectedPaise: 8_400_000n,
              pendingPaise: 7_900_000n,
            },
          ]}
        />
      </ChartCard>
    </div>
  );
}
