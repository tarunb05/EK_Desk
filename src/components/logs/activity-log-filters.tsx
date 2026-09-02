"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/forms/select";
import { DateField } from "@/components/forms/date-field";
import { FilterIcon, UserIcon } from "@/components/shell/nav-icons";
import type { ActivityLogActorOption } from "@/lib/records/activity-log";
import {
  ACTIVITY_LOG_ACTIONS,
  ACTIVITY_LOG_ENTITIES,
  type ActivityLogAction,
  type ActivityLogEntity,
} from "@/lib/shell/activity-log-search-params";

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

export function ActivityLogFilters({
  actors,
}: {
  actors: ActivityLogActorOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const branch = searchParams.get("branch") ?? "all";
  const actor = searchParams.get("actor") ?? "all";
  const action = searchParams.get("action") ?? "all";
  const entity = searchParams.get("entity") ?? "all";

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

  return (
    <>
      {/* Same bare from/to DateField pair as the Expenses and Students
          directory filter panels -- no label above it there either; see
          date-field.tsx's placeholder prop for why each side says
          "Start date"/"End date" rather than the generic "Pick a date" a
          single date field uses. */}
      <div className="flex gap-2">
        <DateField
          ariaLabel="Filter from date"
          placeholder="Start date"
          value={dateFrom}
          onChange={(iso) => updateParam({ dateFrom: iso })}
          className="min-w-0 flex-1"
        />
        <DateField
          ariaLabel="Filter to date"
          placeholder="End date"
          value={dateTo}
          onChange={(iso) => updateParam({ dateTo: iso })}
          className="min-w-0 flex-1"
        />
      </div>

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

      {dateFrom ||
      dateTo ||
      branch !== "all" ||
      actor !== "all" ||
      action !== "all" ||
      entity !== "all" ? (
        <button
          type="button"
          onClick={() =>
            updateParam({
              dateFrom: null,
              dateTo: null,
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
