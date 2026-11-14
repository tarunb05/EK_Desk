import { formatPaise } from "@/lib/domain/money";
import { collectionRate } from "@/lib/domain/collection-rate";
import type {
  AgeingBucket,
  CollectionBreakdownRow,
} from "@/lib/records/dashboard-queries";
import { ChartCard } from "@/components/charts/chart-card";
import { CollectionProgress } from "@/components/charts/collection-progress";
import { MonthColumns } from "@/components/charts/month-columns";
import { AgeingBars } from "@/components/charts/ageing-bars";
import { SplitBars } from "@/components/charts/split-bars";
import { ServiceSwitch } from "./service-switch";

// The landing page's "this is what you get" panel. Not a screenshot and not
// a mock-up: these are the very components the Transport and Daycare
// dashboards render, fed a small set of made-up figures instead of a
// database query. So the panel can never drift from the real product the
// way a saved image does -- restyle a chart and this changes with it.
//
// One sample per service, behind the same Transport / Daycare split the
// signed-in app has. Both panels are rendered here on the server; the
// switch only chooses which one is visible, so the charts ship no JS.
//
// Every number below is invented for the illustration (and labelled as
// sample figures on the page). Each sample is chosen to add up: collected +
// pending = receivable, the ageing buckets sum to pending, the monthly
// columns sum to collected, and the class and route/slot rows each sum to
// the totals -- a preview whose own numbers disagree would undercut the one
// thing it is here to show. landing-preview.test.ts checks all of that.
export interface ServiceSample {
  studentCount: number;
  receivable: bigint;
  collected: bigint;
  overdue: bigint;
  months: [string, bigint][];
  ageing: AgeingBucket[];
  byClass: CollectionBreakdownRow[];
  groupNoun: "route" | "slot";
  byGroup: CollectionBreakdownRow[];
}

function row(
  label: string,
  studentCount: number,
  receivablePaise: bigint,
  collectedPaise: bigint,
): CollectionBreakdownRow {
  return {
    label,
    studentCount,
    receivablePaise,
    collectedPaise,
    pendingPaise: receivablePaise - collectedPaise,
  };
}

// April to March; months not listed yet (the year is still running) get 0.
function yearOfMonths(collected: bigint[]): [string, bigint][] {
  const keys = [
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
    "2027-03",
  ];
  return keys.map((key, i) => [key, collected[i] ?? 0n]);
}

export const TRANSPORT_SAMPLE: ServiceSample = {
  studentCount: 118,
  receivable: 84_600_000n,
  collected: 51_300_000n,
  overdue: 14_800_000n,
  months: yearOfMonths([
    9_400_000n,
    6_100_000n,
    11_200_000n,
    7_300_000n,
    4_900_000n,
    5_600_000n,
    3_700_000n,
    3_100_000n,
  ]),
  ageing: [
    { bucket: "not_yet_due", accountCount: 41, pendingPaise: 18_500_000n },
    { bucket: "1-30", accountCount: 12, pendingPaise: 6_200_000n },
    { bucket: "31-60", accountCount: 7, pendingPaise: 4_900_000n },
    { bucket: "60+", accountCount: 5, pendingPaise: 3_700_000n },
  ],
  byClass: [
    row("Nursery", 34, 26_400_000n, 17_900_000n),
    row("Play Group", 29, 21_800_000n, 11_600_000n),
    row("Euro Junior", 31, 20_100_000n, 13_400_000n),
    row("Euro Senior", 24, 16_300_000n, 8_400_000n),
  ],
  groupNoun: "route",
  byGroup: [
    row("Route 1 - MG Road", 35, 25_100_000n, 16_200_000n),
    row("Route 2 - Whitefield", 31, 22_300_000n, 12_400_000n),
    row("Route 3 - HSR Layout", 28, 20_000_000n, 13_100_000n),
    row("Route 4 - Indiranagar", 24, 17_200_000n, 9_600_000n),
  ],
};

export const DAYCARE_SAMPLE: ServiceSample = {
  studentCount: 46,
  receivable: 41_400_000n,
  collected: 29_700_000n,
  overdue: 5_200_000n,
  months: yearOfMonths([
    5_200_000n,
    3_900_000n,
    4_600_000n,
    3_800_000n,
    3_400_000n,
    3_300_000n,
    2_900_000n,
    2_600_000n,
  ]),
  ageing: [
    { bucket: "not_yet_due", accountCount: 20, pendingPaise: 6_500_000n },
    { bucket: "1-30", accountCount: 6, pendingPaise: 2_800_000n },
    { bucket: "31-60", accountCount: 3, pendingPaise: 1_500_000n },
    { bucket: "60+", accountCount: 2, pendingPaise: 900_000n },
  ],
  byClass: [
    row("Nursery", 14, 12_600_000n, 9_400_000n),
    row("Play Group", 16, 14_400_000n, 10_900_000n),
    row("Euro Junior", 9, 8_100_000n, 5_600_000n),
    row("Euro Senior", 7, 6_300_000n, 3_800_000n),
  ],
  groupNoun: "slot",
  byGroup: [
    row("Full Day (8-6)", 21, 23_100_000n, 17_200_000n),
    row("Morning (8-1)", 15, 10_500_000n, 7_400_000n),
    row("Afternoon (1-6)", 10, 7_800_000n, 5_100_000n),
  ],
};

function ServicePanel({ sample }: { sample: ServiceSample }) {
  const pending = sample.receivable - sample.collected;
  const rate = collectionRate(sample.receivable, sample.collected);
  const tiles = [
    {
      label: "Students enrolled",
      value: String(sample.studentCount),
      className: "bg-surface text-ink",
    },
    {
      label: "Total receivable",
      value: formatPaise(sample.receivable),
      className: "bg-sand text-ink",
    },
    {
      label: "Total collected",
      value: formatPaise(sample.collected),
      className: "bg-accent-fill text-ink",
    },
    {
      label: "Collection rate",
      value: `${rate.toFixed(1)}%`,
      className: "bg-accent text-canvas",
    },
  ];

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`flex min-h-24 flex-col justify-between gap-3 rounded-lg p-4 ${tile.className}`}
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
        receivablePaise={sample.receivable}
        collectedPaise={sample.collected}
        pendingPaise={pending}
        overduePaise={sample.overdue}
        caption="Whole year, as of today"
      />

      <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
        <ChartCard
          title="Collected each month"
          caption="By the date the payment was made"
          className="lg:col-span-2"
        >
          <MonthColumns
            columns={sample.months.map(([month, paise]) => ({ month, paise }))}
            valueLabel="Collected"
            emptyText=""
          />
        </ChartCard>
        <ChartCard title="How old the pending is" caption="By due date">
          <AgeingBars buckets={sample.ageing} />
        </ChartCard>
      </div>

      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        <ChartCard title="By class" caption="Share of fees collected">
          <SplitBars rows={sample.byClass} emptyText="" />
        </ChartCard>
        <ChartCard
          title={`By ${sample.groupNoun}`}
          caption="Share of fees collected"
        >
          <SplitBars rows={sample.byGroup} emptyText="" />
        </ChartCard>
      </div>
    </div>
  );
}

export function LandingPreview() {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-3 md:p-5">
      <ServiceSwitch
        transport={<ServicePanel sample={TRANSPORT_SAMPLE} />}
        daycare={<ServicePanel sample={DAYCARE_SAMPLE} />}
      />
    </div>
  );
}
