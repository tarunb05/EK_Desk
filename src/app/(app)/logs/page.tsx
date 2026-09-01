import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import {
  activityLogActiveFilterCount,
  activityLogSearchParamsSchema,
} from "@/lib/shell/activity-log-search-params";
import {
  getActivityLogActorOptions,
  getActivityLogPage,
} from "@/lib/records/activity-log";
import { ActivityLogTable } from "@/components/logs/activity-log-table";
import { ActivityLogFilters } from "@/components/logs/activity-log-filters";
import { KeysetPaginationControls } from "@/components/logs/keyset-pagination-controls";
import { ScopeSelectors } from "@/components/shell/scope-selectors";
import { SearchField } from "@/components/shell/search-field";
import { FilterMenu } from "@/components/shell/filter-menu";

export const metadata: Metadata = {
  title: "Activity log",
};

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Admin-only, by route -- same mechanism as /transport and /daycare, not
  // by hiding row-level data (there's no row-level grant for a teacher to
  // hide here in the first place; see CLAUDE.md rule 12).
  await requireRole("admin");

  const rawParams = await searchParams;
  const filterParams = activityLogSearchParamsSchema.parse(rawParams);

  const supabase = await createClient();
  const [years, branches, actors] = await Promise.all([
    getAcademicYears(supabase),
    getBranches(supabase),
    getActivityLogActorOptions(supabase),
  ]);

  const selectedBranch = branches.find((b) => b.code === filterParams.branch);

  const { rows, nextCursor, seededAt, filtersActive } =
    await getActivityLogPage(supabase, {
      cursor: filterParams.cursor,
      filters: {
        dateFrom: filterParams.dateFrom,
        dateTo: filterParams.dateTo,
        branchId: selectedBranch?.id,
        actorId: filterParams.actor && filterParams.actor !== "all" ? filterParams.actor : undefined,
        action: filterParams.action === "all" ? undefined : filterParams.action,
        entity: filterParams.entity === "all" ? undefined : filterParams.entity,
        q: filterParams.q,
      },
    });

  const activeCount = activityLogActiveFilterCount(filterParams);

  const branchNameById = Object.fromEntries(
    branches.map((branch) => [branch.id, branch.name]),
  );
  const yearLabelById = Object.fromEntries(
    years.map((y) => [y.id, y.label]),
  );

  const flatSearchParams = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  // The export always fetches every matching row (getAllActivityLogRows,
  // not the paginated getActivityLogPage) -- cursor describes a position
  // in the on-screen list, which has no meaning for "download everything
  // this filter matches."
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(flatSearchParams)) {
    if (value !== undefined && key !== "cursor") exportParams.set(key, value);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium text-ink">Activity log</h1>

      <div className="flex items-center justify-end gap-2">
        <SearchField
          ariaLabel="Search by name or summary"
          placeholder="Search"
          paginationParam="cursor"
        />
        <FilterMenu activeCount={activeCount}>
          <ScopeSelectors years={years} branches={branches} paginationParam="cursor" />
          <ActivityLogFilters actors={actors} />
        </FilterMenu>
        <a
          href={`/api/export/logs?${exportParams.toString()}`}
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
        >
          Download
        </a>
      </div>

      <ActivityLogTable
        rows={rows}
        seededAt={seededAt}
        filtersActive={filtersActive}
        branchNameById={branchNameById}
        yearLabelById={yearLabelById}
      />

      {rows.length > 0 ? (
        <KeysetPaginationControls
          hasCursor={filterParams.cursor !== undefined}
          nextCursor={nextCursor}
          searchParams={flatSearchParams}
        />
      ) : null}
    </div>
  );
}
