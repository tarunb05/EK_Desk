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
}

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
        <div className="flex items-center gap-1.5 text-sm text-ink-secondary">
          <CalendarIcon size={14} />
          Year
          <Select
            ariaLabel="Year"
            value={currentYearLabel}
            onChange={(next) => updateParam("year", next)}
            options={years.map((year) => ({
              value: year.label,
              label: year.label,
            }))}
            className="w-28"
            triggerClassName="h-8"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 text-sm text-ink-secondary">
        <BranchIcon size={14} />
        Branch
        <Select
          ariaLabel="Branch"
          value={currentBranch}
          onChange={(next) => updateParam("branch", next)}
          options={[
            { value: "all", label: "All branches" },
            ...branches.map((branch) => ({
              value: branch.code,
              label: branch.name,
            })),
          ]}
          className="w-36"
          triggerClassName="h-8"
        />
      </div>
    </div>
  );
}
