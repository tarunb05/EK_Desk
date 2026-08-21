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
import { ExportPdfButton } from "@/components/records/export-pdf-button";
import { ScopeSelectors } from "@/components/shell/scope-selectors";

interface ServiceScopeDashboardProps {
  serviceType: ServiceType;
  title: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// One dashboard, reused by /transport and /daycare with a different
// service_type — the money and aggregation logic exists exactly once. The
// per-student record listing lives on /students now (across both services,
// with search/filter/sort) rather than duplicated here — this page stays
// figures, the by-branch split, "Add student", and the PDF export. There
// are no charts on this page any more (ageing/by-class/by-route/
// collection-by-month were all removed) — the underlying SQL functions and
// their integration tests are left in place since nothing about the
// schema itself changed, and collection-by-month's data now drives the
// month filter below instead of a chart.
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

  // Only Total collected / Collection rate scope to the selected month(s) —
  // Receivable/Pending/Overdue are point-in-time balances, not sums over a
  // date range, so they stay whole-year regardless of this filter.
  const monthsParam = rawParams.months;
  const selectedMonths = (typeof monthsParam === "string" ? monthsParam : "")
    .split(",")
    .filter(Boolean);

  const collectedInSelectedMonths =
    selectedMonths.length > 0
      ? collectionByMonth
          .filter((row) => selectedMonths.includes(row.month))
          .reduce((sum, row) => sum + row.collectedPaise, 0n)
      : summary.totalCollectedPaise;

  const displaySummary = {
    ...summary,
    totalCollectedPaise: collectedInSelectedMonths,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-medium text-ink">{title}</h1>
          <ScopeSelectors years={years} branches={branches} />
        </div>
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

      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Collected &amp; rate below scope to the selected months
        </span>
        <MonthFilter
          availableMonths={collectionByMonth.map((row) => row.month)}
        />
      </div>

      <StatCards summary={displaySummary} />

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
