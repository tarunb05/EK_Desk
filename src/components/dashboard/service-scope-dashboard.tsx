import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import { generateTwelveMonths } from "@/lib/domain/academic-year";
import {
  getAgeingBuckets,
  getBreakdownByClass,
  getBreakdownByGroup,
  getCollectionByMonth,
  getDashboardSummary,
} from "@/lib/records/dashboard-queries";
import type { ServiceType } from "@/lib/records/types";
import { StatCards } from "@/components/dashboard/stat-cards";
import { BranchSplitTable } from "@/components/dashboard/branch-split-table";
import { MonthFilter } from "@/components/dashboard/month-filter";
import { ScopeSelectors } from "@/components/shell/scope-selectors";
import { FilterGroup, FilterMenu } from "@/components/shell/filter-menu";
import { ChartCard } from "@/components/charts/chart-card";
import { CollectionProgress } from "@/components/charts/collection-progress";
import { MonthColumns } from "@/components/charts/month-columns";
import { SplitBars } from "@/components/charts/split-bars";
import { AgeingBars } from "@/components/charts/ageing-bars";

interface ServiceScopeDashboardProps {
  serviceType: ServiceType;
  title: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// One dashboard, reused by /transport and /daycare with a different
// service_type — the money and aggregation logic exists exactly once. The
// per-student record listing lives on /students now (across both services,
// with search/filter/sort) rather than duplicated here — this page stays
// figures, the by-branch split, and "Add student". There are no charts on
// this page any more (ageing/by-class/by-route/collection-by-month were
// all removed) — the underlying SQL functions and their integration tests
// are left in place since nothing about the schema itself changed, and
// collection-by-month's data now drives the month filter instead of a
// chart.
export async function ServiceScopeDashboard({
  serviceType,
  title,
  searchParams,
}: ServiceScopeDashboardProps) {
  const rawParams = await searchParams;
  const scopeParams = shellSearchParamsSchema.parse(rawParams);

  const supabase = await createClient();
  const { year, branch } = await getCurrentScope(scopeParams);

  const scope = { serviceType, academicYearId: year.id, branch };
  const [
    summary,
    collectionByMonth,
    ageing,
    byClass,
    byGroup,
    branches,
    years,
  ] = await Promise.all([
    getDashboardSummary(supabase, scope),
    getCollectionByMonth(supabase, scope),
    getAgeingBuckets(supabase, scope),
    getBreakdownByClass(supabase, scope),
    getBreakdownByGroup(supabase, scope),
    getBranches(supabase),
    getAcademicYears(supabase),
  ]);

  // branch=all gets a per-branch split of the figures (called out by name
  // in the phase plan).
  const activeBranches = branches.filter((b) => b.isActive);
  const isAllBranches = branch === "all";

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

  // Only Total collected / Collection rate scope to the selected month(s) —
  // Receivable/Pending/Overdue are point-in-time balances, not sums over a
  // date range, so they stay whole-year regardless of this filter.
  const monthsParam = rawParams.months;
  const selectedMonths = (typeof monthsParam === "string" ? monthsParam : "")
    .split(",")
    .filter(Boolean);

  const matchingMonthRows = collectionByMonth.filter((row) =>
    selectedMonths.includes(row.month),
  );

  const collectedInSelectedMonths =
    selectedMonths.length > 0
      ? matchingMonthRows.reduce((sum, row) => sum + row.collectedPaise, 0n)
      : summary.totalCollectedPaise;

  // A selected month with zero collections doesn't appear in
  // collectionByMonth at all (it only carries months with at least one real
  // payment), so "no matching rows" means "nothing was collected in any of
  // the selected months" — worth calling out explicitly rather than letting
  // it read as an unremarkable ₹0.
  const selectedMonthsHaveNoData =
    selectedMonths.length > 0 && matchingMonthRows.length === 0;

  const displaySummary = {
    ...summary,
    totalCollectedPaise: collectedInSelectedMonths,
  };

  // The dashboard always offers all 12 calendar months of the selected
  // academic year as filter options, regardless of whether a given month
  // has any recorded collections yet — collectionByMonth only lists months
  // with real data, so it can't be the source of the option list itself.
  const allTwelveMonths = generateTwelveMonths(year.startsOn);

  // Every month of the year gets a column, including the ones with no
  // payments -- collectionByMonth omits those, and a chart that skips an
  // empty month hides exactly the gap the office would want to see.
  const collectedByMonth = new Map(
    collectionByMonth.map((row) => [row.month, row.collectedPaise]),
  );
  const monthColumns = allTwelveMonths.map((month) => ({
    month,
    paise: collectedByMonth.get(month) ?? 0n,
    dimmed: selectedMonths.length > 0 && !selectedMonths.includes(month),
  }));

  const branchName =
    branch === "all"
      ? "All branches"
      : (branches.find((b) => b.code === branch)?.name ?? branch);
  const scopeCaption = `${year.label} · ${branchName}`;
  const groupNoun = serviceType === "transport" ? "route" : "slot";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-secondary">{scopeCaption}</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterMenu>
            <ScopeSelectors years={years} branches={branches} />
            <FilterGroup label="Months collected in">
              <MonthFilter availableMonths={allTwelveMonths} />
            </FilterGroup>
          </FilterMenu>
          <Link
            href={`/${serviceType}/new`}
            className="inline-block h-9 rounded-full bg-accent px-4 text-sm font-medium leading-9 text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
          >
            Add student
          </Link>
        </div>
      </div>

      <StatCards
        summary={displaySummary}
        collectedFiguresUnavailable={selectedMonthsHaveNoData}
        exportScope={{ serviceType, academicYearId: year.id, branch }}
      />

      {/* Whole-year balances on purpose, like the Receivable/Pending/
          Overdue tiles above: the month filter narrows what was collected
          *in* a month, which is what the columns below show, not how the
          receivable for the year splits today. */}
      <CollectionProgress
        receivablePaise={summary.totalReceivablePaise}
        collectedPaise={summary.totalCollectedPaise}
        pendingPaise={summary.totalPendingPaise}
        overduePaise={summary.totalOverduePaise}
        caption="Whole year, as of today"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          title="Collected each month"
          caption={
            selectedMonths.length > 0
              ? "Filtered months in slate"
              : "By the date the payment was made"
          }
          className="lg:col-span-2"
        >
          <MonthColumns
            columns={monthColumns}
            valueLabel="Collected"
            emptyText="No payments recorded in this year yet. Collections appear here month by month as they are recorded."
          />
        </ChartCard>

        <ChartCard title="How old the pending is" caption="By due date">
          <AgeingBars buckets={ageing} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="By class" caption="Share of fees collected">
          <SplitBars
            rows={byClass}
            emptyText="No students are enrolled in this scope yet. Classes appear here once they are."
          />
        </ChartCard>
        <ChartCard title={`By ${groupNoun}`} caption="Share of fees collected">
          <SplitBars
            rows={byGroup}
            emptyText={`No students are enrolled in this scope yet. Each ${groupNoun} appears here once they are.`}
          />
        </ChartCard>
      </div>

      {branchSplit ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
            By branch
          </h2>
          <BranchSplitTable rows={branchSplit} />
        </div>
      ) : null}
    </div>
  );
}
