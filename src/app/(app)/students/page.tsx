import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import { requireAuth } from "@/lib/auth/require-role";
import { defaultAcademicYear } from "@/lib/domain/academic-year";
import { todayInIndia } from "@/lib/domain/datetime";
import {
  AGEING_FILTER_LABELS,
  type StudentSortKey,
} from "@/lib/shell/student-table-params";
import { studentDirectorySearchParamsSchema } from "@/lib/shell/student-search-params";
import {
  getStudentClassSections,
  getStudentDirectory,
} from "@/lib/records/student-directory";
import { StudentDirectoryFilters } from "@/components/students/student-directory-filters";
import { StudentDirectoryTable } from "@/components/students/student-directory-table";
import { ScopeSelectors } from "@/components/shell/scope-selectors";
import { FilterMenu } from "@/components/shell/filter-menu";
import { SearchField } from "@/components/shell/search-field";

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "Students",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const scopeParams = shellSearchParamsSchema.parse(rawParams);
  const tableParams = studentDirectorySearchParamsSchema.parse(rawParams);

  const authed = await requireAuth();
  const supabase = await createClient();
  const [{ branch }, branches, classSections, academicYears] =
    await Promise.all([
      getCurrentScope(scopeParams),
      getBranches(supabase),
      getStudentClassSections(supabase),
      getAcademicYears(supabase),
    ]);

  // The label lives in the URL (URL-as-state, matching every other filter
  // here). "all" is an explicit choice (no filter, every year); no param
  // at all means the page just loaded, which defaults to the current year
  // -- matching the dashboards' own default -- rather than showing every
  // student's every year's account unfiltered. An unmatched/stale label
  // falls back to the current year too, same as a missing one.
  const currentYear = defaultAcademicYear(academicYears, todayInIndia());
  const matchedYear = academicYears.find(
    (year) => year.label === tableParams.academicYear,
  );
  const academicYearId =
    tableParams.academicYear === "all"
      ? undefined
      : (matchedYear ?? currentYear)?.id;

  const { rows, pagination } = await getStudentDirectory(supabase, {
    branch,
    service: tableParams.service,
    academicYearId,
    table: tableParams,
    page: tableParams.page,
    pageSize: PAGE_SIZE,
  });

  const flatSearchParams = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  // Arrived from a dashboard ageing row: say so, and offer the way back to
  // the full list (same URL minus ageing, back to page 1). Mirrors when the
  // query layer applies it -- one service and one year.
  const ageingChip =
    tableParams.ageing && tableParams.service !== "all" && academicYearId
      ? {
          label: [
            tableParams.service === "transport" ? "Transport" : "Daycare",
            AGEING_FILTER_LABELS[tableParams.ageing],
            academicYears.find((year) => year.id === academicYearId)?.label,
          ]
            .filter(Boolean)
            .join(" · "),
          clearHref: `/students?${new URLSearchParams(
            Object.entries(flatSearchParams).filter(
              (entry): entry is [string, string] =>
                entry[0] !== "ageing" &&
                entry[0] !== "page" &&
                typeof entry[1] === "string",
            ),
          ).toString()}`,
        }
      : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">Students</h1>

      <div className="flex items-center justify-end gap-2">
        <SearchField
          ariaLabel="Search by name or admission number"
          placeholder="Search"
        />
        <FilterMenu>
          <ScopeSelectors branches={branches} />
          <StudentDirectoryFilters
            classSections={classSections}
            academicYears={academicYears}
          />
        </FilterMenu>
        <Link
          href="/students/new"
          className="inline-block h-9 rounded-full bg-accent px-4 text-sm font-medium leading-9 text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
        >
          Add student
        </Link>
      </div>

      {ageingChip ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-secondary">Pending accounts:</span>
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-sand pl-3 pr-1 text-ink">
            {ageingChip.label}
            <Link
              href={ageingChip.clearHref}
              aria-label="Clear the pending-age filter"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </Link>
          </span>
        </div>
      ) : null}

      <StudentDirectoryTable
        rows={rows}
        sort={tableParams.sort as StudentSortKey}
        dir={tableParams.dir}
        page={pagination.page}
        pageSize={PAGE_SIZE}
        totalPages={pagination.totalPages}
        searchParams={flatSearchParams}
        role={authed.role}
      />
    </div>
  );
}
