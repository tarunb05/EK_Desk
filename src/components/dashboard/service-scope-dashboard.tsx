import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import {
  getCollectionByMonth,
  getDashboardSummary,
} from "@/lib/records/dashboard-queries";
import type { ServiceType } from "@/lib/records/types";
import { StatCards } from "@/components/dashboard/stat-cards";
import { BranchSplitTable } from "@/components/dashboard/branch-split-table";
import { MonthFilter } from "@/components/dashboard/month-filter";
import { ScopeSelectors } from "@/components/shell/scope-selectors";
import { FilterMenu } from "@/components/shell/filter-menu";

interface ServiceScopeDashboardProps {
  serviceType: ServiceType;
  title: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Produces the 12 "YYYY-MM" keys spanning one academic year starting on
// startsOn (e.g. "2026-04-01" -> Apr 2026 .. Mar 2027), matching the key
// format used by collectionByMonth and the months URL param.
function generateTwelveMonths(startsOn: string): string[] {
  const [startYear, startMonth] = startsOn.split("-").map(Number);
  if (!startYear || !startMonth) return [];

  return Array.from({ length: 12 }, (_, i) => {
    const monthIndex = startMonth - 1 + i;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
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

  const [summary, collectionByMonth, branches, years] = await Promise.all([
    getDashboardSummary(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getCollectionByMonth(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-medium text-ink">{title}</h1>

      <div className="flex items-center justify-end gap-2">
        <FilterMenu>
          <ScopeSelectors years={years} branches={branches} />
          <MonthFilter availableMonths={allTwelveMonths} />
        </FilterMenu>
        <Link
          href={`/${serviceType}/new`}
          className="inline-block h-9 rounded-md bg-accent px-4 text-sm font-medium leading-9 text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
        >
          Add student
        </Link>
      </div>

      <StatCards
        summary={displaySummary}
        collectedFiguresUnavailable={selectedMonthsHaveNoData}
        exportScope={{ serviceType, academicYearId: year.id, branch }}
      />

      {branchSplit ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            By branch
          </h2>
          <BranchSplitTable rows={branchSplit} />
        </div>
      ) : null}
    </div>
  );
}
