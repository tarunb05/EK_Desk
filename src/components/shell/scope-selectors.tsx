"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AcademicYearOption,
  BranchOption,
} from "@/lib/shell/resolve-year-branch";
import { BranchIcon, CalendarIcon } from "./nav-icons";
import { Select } from "@/components/forms/select";

interface ScopeSelectorsProps {
  // Omit years entirely on pages that aren't scoped to an academic year
  // (the student directory spans every year) — showing a Year selector
  // there would imply a filter that doesn't actually do anything.
  years?: AcademicYearOption[];
  branches: BranchOption[];
  // See SearchField's identical prop -- the activity log (phase 12.3)
  // paginates with ?cursor=, not ?page=, and a stale cursor left in place
  // after changing year/branch would silently apply the old position to
  // the newly-scoped query instead of starting from the top.
  paginationParam?: "page" | "cursor";
}

// Same icon-in-trigger pill style as every other filter in the panel
// (Status/Service/Class/Year on Students, Category/Method on Expenses) --
// Year/Branch used to render as a separate "icon + label text + select"
// row, which made them look like a different kind of control from
// everything else in the same panel.
export function ScopeSelectors({
  years,
  branches,
  paginationParam = "page",
}: ScopeSelectorsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYearLabel =
    searchParams.get("year") ??
    years?.find((year) => year.isCurrent)?.label ??
    years?.[0]?.label ??
    "";
  const currentBranch = searchParams.get("branch") ?? "all";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    // Unchanged from before this prop existed: every current caller
    // (Transport, Daycare, Expenses, Students) never reset pagination
    // here, only the activity log's ?cursor= needs to be, since a stale
    // one would otherwise apply silently to the newly-scoped query.
    if (paginationParam === "cursor") {
      params.delete("cursor");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      {years ? (
        <Select
          ariaLabel="Filter by academic year"
          icon={<CalendarIcon size={14} />}
          value={currentYearLabel}
          onChange={(next) => updateParam("year", next)}
          options={years.map((year) => ({
            value: year.label,
            label: year.label,
          }))}
          className="w-full"
        />
      ) : null}

      <Select
        ariaLabel="Filter by branch"
        icon={<BranchIcon size={14} />}
        value={currentBranch}
        onChange={(next) => updateParam("branch", next)}
        options={[
          { value: "all", label: "All branches" },
          ...branches.map((branch) => ({
            value: branch.code,
            label: branch.name,
          })),
        ]}
        className="w-full"
      />
    </>
  );
}
