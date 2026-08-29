"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/forms/select";
import { FilterIcon, UserIcon } from "@/components/shell/nav-icons";
import type { ActivityLogActorOption } from "@/lib/records/activity-log";
import {
  ACTIVITY_LOG_ACTIONS,
  ACTIVITY_LOG_ENTITIES,
  type ActivityLogAction,
  type ActivityLogEntity,
} from "@/lib/shell/activity-log-search-params";
import { generateTwelveMonths } from "@/lib/domain/academic-year";

const ACTION_OPTIONS: Record<ActivityLogAction | "all", string> = {
  all: "All actions",
  create: "Created",
  update: "Edited",
  delete: "Deleted",
};

const ENTITY_OPTIONS: Record<ActivityLogEntity | "all", string> = {
  all: "All types",
  student: "Student",
  fee_account: "Fee account",
  payment: "Payment",
  expense: "Expense",
  expense_category: "Category",
  student_submission: "Submission",
  profile: "User",
};

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function ActivityLogFilters({
  academicYearStartsOn,
  actors,
}: {
  academicYearStartsOn: string;
  actors: ActivityLogActorOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const month = searchParams.get("month") ?? "";
  const day = searchParams.get("day") ?? "";
  const branch = searchParams.get("branch") ?? "all";
  const actor = searchParams.get("actor") ?? "all";
  const action = searchParams.get("action") ?? "all";
  const entity = searchParams.get("entity") ?? "all";

  const months = generateTwelveMonths(academicYearStartsOn);

  function updateParam(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    // Every filter here invalidates whatever position a keyset cursor was
    // pointing at -- see SearchField/ScopeSelectors' identical comment.
    params.delete("cursor");
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateMonth(nextMonth: string) {
    // Changing the month can strand a previously-picked day outside it --
    // clear the day rather than silently keep a filter that no longer
    // matches what the month selector shows.
    updateParam({ month: nextMonth || null, day: null });
  }

  return (
    <>
      <Select
        ariaLabel="Filter by month"
        icon={<FilterIcon size={14} />}
        value={month}
        onChange={updateMonth}
        options={[
          { value: "", label: "All months" },
          ...months.map((key) => ({ value: key, label: monthLabel(key) })),
        ]}
        className="w-full"
      />

      <label className="flex flex-col gap-1 text-sm text-ink-secondary">
        <span className="text-2xs uppercase tracking-wide text-ink-muted">
          Day
        </span>
        {/* Native <input type="date">, deliberately -- not the custom
            Calendar popover used for form fields elsewhere in this app.
            min/max clamp it to the selected month so the browser's own UI
            can't offer an out-of-range day, and it's disabled until a
            month is chosen, since "which day" only means something once
            "which month" has narrowed the range. */}
        <input
          type="date"
          aria-label="Filter by day"
          value={day}
          min={month ? `${month}-01` : undefined}
          max={month ? `${month}-31` : undefined}
          disabled={!month}
          onChange={(event) => updateParam({ day: event.target.value || null })}
          className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <Select
        ariaLabel="Filter by who did it"
        icon={<UserIcon size={14} />}
        value={actor}
        onChange={(next) => updateParam({ actor: next === "all" ? null : next })}
        options={[
          { value: "all", label: "Everyone" },
          ...actors.map((option) => ({
            value: option.id,
            label: option.isActive
              ? option.fullName
              : `${option.fullName} (deactivated)`,
          })),
        ]}
        className="w-full"
      />

      <Select
        ariaLabel="Filter by action"
        icon={<FilterIcon size={14} />}
        value={action}
        onChange={(next) => updateParam({ action: next === "all" ? null : next })}
        options={(["all", ...ACTIVITY_LOG_ACTIONS] as const).map((value) => ({
          value,
          label: ACTION_OPTIONS[value],
        }))}
        className="w-full"
      />

      <Select
        ariaLabel="Filter by type"
        icon={<FilterIcon size={14} />}
        value={entity}
        onChange={(next) => updateParam({ entity: next === "all" ? null : next })}
        options={(["all", ...ACTIVITY_LOG_ENTITIES] as const).map((value) => ({
          value,
          label: ENTITY_OPTIONS[value],
        }))}
        className="w-full"
      />

      {month ||
      day ||
      branch !== "all" ||
      actor !== "all" ||
      action !== "all" ||
      entity !== "all" ? (
        <button
          type="button"
          onClick={() =>
            updateParam({
              month: null,
              day: null,
              branch: null,
              actor: null,
              action: null,
              entity: null,
            })
          }
          className="self-start text-xs text-accent hover:underline"
        >
          Clear all
        </button>
      ) : null}
    </>
  );
}
