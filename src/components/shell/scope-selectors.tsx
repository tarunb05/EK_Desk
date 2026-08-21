"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AcademicYearOption,
  BranchOption,
} from "@/lib/shell/resolve-year-branch";

interface ScopeSelectorsProps {
  // Omit years entirely on pages that aren't scoped to an academic year
  // (the student directory spans every year) — showing a Year selector
  // there would imply a filter that doesn't actually do anything.
  years?: AcademicYearOption[];
  branches: BranchOption[];
}

const selectClassName =
  "h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink";

export function ScopeSelectors({ years, branches }: ScopeSelectorsProps) {
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
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {years ? (
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          Year
          <select
            value={currentYearLabel}
            onChange={(event) => updateParam("year", event.target.value)}
            className={selectClassName}
          >
            {years.map((year) => (
              <option key={year.id} value={year.label}>
                {year.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        Branch
        <select
          value={currentBranch}
          onChange={(event) => updateParam("branch", event.target.value)}
          className={selectClassName}
        >
          <option value="all">All branches</option>
          {branches.map((branch) => (
            <option key={branch.code} value={branch.code}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
