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
  getCollectedInMonths,
  getCollectionByMonth,
  getDashboardSummary,
  withCollectedInMonths,
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
// per-student record listing lives on /students (across both services, with
// search/filter/sort); this page is the figures, the charts that explain
// them, the by-branch split, and "Add student".
//
// Filters: year and branch scope every query on the page. The month filter
// scopes everything that is a sum of payments (Total collected, Collection
// rate, the monthly columns, and the collected part of By class / By route
// / By slot). Receivable, pending, overdue and ageing are balances as of
// today, so they stay whole-year whatever months are picked.
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

  // Only Total collected / Collection rate scope to the selected month(s) —
  // Receivable/Pending/Overdue are point-in-time balances, not sums over a
  // date range, so they stay whole-year regardless of this filter.
  const monthsParam = rawParams.months;
  const selectedMonths = (typeof monthsParam === "string" ? monthsParam : "")
    .split(",")
    .filter(Boolean);

  const [
    summary,
    collectionByMonth,
    ageing,
    byClass,
    byGroup,
    branches,
    years,
    collectedInMonths,
  ] = await Promise.all([
    getDashboardSummary(supabase, scope),
    getCollectionByMonth(supabase, scope),
    getAgeingBuckets(supabase, scope),
    getBreakdownByClass(supabase, scope),
    getBreakdownByGroup(supabase, scope),
    getBranches(supabase),
    getAcademicYears(supabase),
    selectedMonths.length > 0
      ? getCollectedInMonths(supabase, scope, selectedMonths)
      : null,
  ]);

  // With months picked, the class and route/slot bars mark what was paid in
  // those months, so they agree with the Total collected tile above them.
  const byClassRows = collectedInMonths
    ? withCollectedInMonths(byClass, collectedInMonths.byClass)
    : byClass;
  const byGroupRows = collectedInMonths
    ? withCollectedInMonths(byGroup, collectedInMonths.byGroup)
    : byGroup;

  // branch=all gets a per-branch split of the figures (called out by name
  // in the phase plan).
  const activeBranches = branches.filter((b) => b.isActive);
  const isAllBranches = branch === "all";

  // With months picked, each branch's Collected (and so its Rate) is what it
  // collected in those months, the same rule as the Total collected tile.
  const branchSplit = isAllBranches
    ? await Promise.all(
        activeBranches.map(async (b) => {
          const branchScope = {
            serviceType,
            academicYearId: year.id,
            branch: b.code,
          };
          const [branchSummary, branchByMonth] = await Promise.all([
            getDashboardSummary(supabase, branchScope),
            selectedMonths.length > 0
              ? getCollectionByMonth(supabase, branchScope)
              : null,
          ]);
          return {
            branch: b,
            summary: branchByMonth
              ? {
                  ...branchSummary,
                  totalCollectedPaise: branchByMonth
                    .filter((row) => selectedMonths.includes(row.month))
                    .reduce((sum, row) => sum + row.collectedPaise, 0n),
                }
              : branchSummary,
          };
        }),
      )
    : null;

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
  const splitCaption =
    selectedMonths.length > 0
      ? "Collected in the selected months"
      : "Share of fees collected";

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

        <ChartCard
          title="How old the pending is"
          caption="By due date · click a row to see the students"
        >
          <AgeingBars
            buckets={ageing}
            hrefFor={(bucket) =>
              `/students?${new URLSearchParams({
                service: serviceType,
                academicYear: year.label,
                branch,
                ageing: bucket,
              }).toString()}`
            }
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="By class" caption={splitCaption}>
          <SplitBars
            rows={byClassRows}
            emptyText="No students are enrolled in this scope yet. Classes appear here once they are."
          />
        </ChartCard>
        <ChartCard title={`By ${groupNoun}`} caption={splitCaption}>
          <SplitBars
            rows={byGroupRows}
            emptyText={`No students are enrolled in this scope yet. Each ${groupNoun} appears here once they are.`}
          />
        </ChartCard>
      </div>

      {branchSplit ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
            By branch
            {selectedMonths.length > 0 ? (
              <span className="ml-2 normal-case tracking-normal">
                Collected and rate for the selected months
              </span>
            ) : null}
          </h2>
          <BranchSplitTable rows={branchSplit} />
        </div>
      ) : null}
    </div>
  );
}
