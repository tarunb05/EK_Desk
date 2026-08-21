import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import {
  getAgeingBuckets,
  getBreakdownByClass,
  getBreakdownByGroup,
  getCollectionByMonth,
  getDashboardSummary,
  type AgeingBucketSummary,
} from "@/lib/records/dashboard-queries";
import type { ServiceType } from "@/lib/records/types";
import { paiseToRupees } from "@/lib/domain/money";
import { StatCards } from "@/components/dashboard/stat-cards";
import { BranchSplitTable } from "@/components/dashboard/branch-split-table";
import {
  BreakdownBarChart,
  type ChartSeries,
} from "@/components/dashboard/charts/breakdown-bar-chart";
import { ExportPdfButton } from "@/components/records/export-pdf-button";

const BUCKET_ORDER = ["not_yet_due", "1-30", "31-60", "60+"] as const;
const BUCKET_LABELS: Record<(typeof BUCKET_ORDER)[number], string> = {
  not_yet_due: "Not yet due",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "60+": "60+ days",
};

// Categorical series with no inherent positive/negative meaning (here: one
// branch vs another) use the design system's chart series order, not the
// collected=positive/pending=attention semantic colors used elsewhere.
const CHART_SERIES_ORDER = [
  "var(--accent-fill)",
  "var(--positive-fill)",
  "var(--attention-fill)",
  "var(--border)",
];

interface ServiceScopeDashboardProps {
  serviceType: ServiceType;
  title: string;
  groupByLabel: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// One dashboard, reused by /transport and /daycare with a different
// service_type — the money and aggregation logic exists exactly once. The
// per-student record listing lives on /students now (across both services,
// with search/filter/sort) rather than duplicated here — this page stays
// figures and charts, plus "Add student" and the PDF export.
export async function ServiceScopeDashboard({
  serviceType,
  title,
  groupByLabel,
  searchParams,
}: ServiceScopeDashboardProps) {
  const rawParams = await searchParams;
  const scopeParams = shellSearchParamsSchema.parse(rawParams);

  const supabase = await createClient();
  const { year, branch } = await getCurrentScope(scopeParams);

  const [
    summary,
    ageingBuckets,
    collectionByMonth,
    byClass,
    byGroup,
    branches,
  ] = await Promise.all([
    getDashboardSummary(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getAgeingBuckets(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getCollectionByMonth(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getBreakdownByClass(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getBreakdownByGroup(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getBranches(supabase),
  ]);

  // branch=all gets a per-branch split of the figures and the ageing chart
  // (called out by name in the phase plan); the other breakdown charts stay
  // combined totals rather than growing another series per branch.
  const activeBranches = branches.filter((b) => b.isActive);
  const isAllBranches = branch === "all";
  const branchLabel = isAllBranches
    ? "All branches"
    : (branches.find((b) => b.code === branch)?.name ?? branch);

  const branchSplit = isAllBranches
    ? await Promise.all(
        activeBranches.map(async (b) => ({
          branch: b,
          summary: await getDashboardSummary(supabase, {
            serviceType,
            academicYearId: year.id,
            branch: b.code,
          }),
        })),
      )
    : null;

  const ageingByBranch = isAllBranches
    ? new Map<string, AgeingBucketSummary[]>(
        await Promise.all(
          activeBranches.map(
            async (b) =>
              [
                b.code,
                await getAgeingBuckets(supabase, {
                  serviceType,
                  academicYearId: year.id,
                  branch: b.code,
                }),
              ] as const,
          ),
        ),
      )
    : null;

  const ageingByBucket = new Map(ageingBuckets.map((row) => [row.bucket, row]));
  const ageingChartData = BUCKET_ORDER.map((bucket) => {
    const row: Record<string, string | number> = {
      bucket: BUCKET_LABELS[bucket],
    };
    if (ageingByBranch) {
      for (const b of activeBranches) {
        const match = (ageingByBranch.get(b.code) ?? []).find(
          (x) => x.bucket === bucket,
        );
        row[b.code] = paiseToRupees(match?.pendingPaise ?? 0n);
      }
    } else {
      row.pending = paiseToRupees(
        ageingByBucket.get(bucket)?.pendingPaise ?? 0n,
      );
    }
    return row;
  });

  const ageingSeries: ChartSeries[] = ageingByBranch
    ? activeBranches.map((b, i) => ({
        key: b.code,
        label: b.name,
        color: CHART_SERIES_ORDER[i % CHART_SERIES_ORDER.length]!,
      }))
    : [{ key: "pending", label: "Pending", color: "var(--attention-fill)" }];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-ink">{title}</h1>
        <div className="flex gap-2">
          <ExportPdfButton
            serviceType={serviceType}
            academicYearId={year.id}
            branch={branch}
            yearLabel={year.label}
            branchLabel={branchLabel}
          />
          <Link
            href={`/${serviceType}/new`}
            className="h-9 rounded-md bg-accent px-4 text-sm font-medium leading-9 text-surface transition-colors duration-150"
          >
            Add student
          </Link>
        </div>
      </div>

      <StatCards summary={summary} />

      {branchSplit ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            By branch
          </h2>
          <BranchSplitTable rows={branchSplit} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Collection by month
          </h2>
          {collectionByMonth.length === 0 ? (
            <p className="py-8 text-sm text-ink-muted">
              No payments recorded yet for this scope.
            </p>
          ) : (
            <BreakdownBarChart
              data={collectionByMonth.map((row) => ({
                month: row.month,
                collected: paiseToRupees(row.collectedPaise),
              }))}
              categoryKey="month"
              series={[
                {
                  key: "collected",
                  label: "Collected",
                  color: "var(--accent-fill)",
                },
              ]}
            />
          )}
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Ageing
          </h2>
          <BreakdownBarChart
            data={ageingChartData}
            categoryKey="bucket"
            series={ageingSeries}
          />
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            By class / section
          </h2>
          {byClass.length === 0 ? (
            <p className="py-8 text-sm text-ink-muted">
              No accounts in this scope yet.
            </p>
          ) : (
            <BreakdownBarChart
              data={byClass.map((row) => ({
                classSection: row.label,
                collected: paiseToRupees(row.collectedPaise),
                pending: paiseToRupees(row.pendingPaise),
              }))}
              categoryKey="classSection"
              series={[
                {
                  key: "collected",
                  label: "Collected",
                  color: "var(--positive-fill)",
                },
                {
                  key: "pending",
                  label: "Pending",
                  color: "var(--attention-fill)",
                },
              ]}
            />
          )}
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            By {groupByLabel.toLowerCase()}
          </h2>
          {byGroup.length === 0 ? (
            <p className="py-8 text-sm text-ink-muted">
              No accounts in this scope yet.
            </p>
          ) : (
            <BreakdownBarChart
              data={byGroup.map((row) => ({
                group: row.label,
                collected: paiseToRupees(row.collectedPaise),
                pending: paiseToRupees(row.pendingPaise),
              }))}
              categoryKey="group"
              series={[
                {
                  key: "collected",
                  label: "Collected",
                  color: "var(--positive-fill)",
                },
                {
                  key: "pending",
                  label: "Pending",
                  color: "var(--attention-fill)",
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
