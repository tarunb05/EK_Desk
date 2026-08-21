"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STATUS_FILTERS } from "@/lib/shell/table-params";

interface TableFiltersProps {
  classSections: string[];
}

const STATUS_LABELS: Record<(typeof STATUS_FILTERS)[number], string> = {
  all: "All statuses",
  overdue: "Overdue",
  pending: "Pending",
  paid: "Paid",
};

export function TableFilters({ classSections }: TableFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder="Search by student name"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(event) => updateParam("q", event.target.value)}
        className="h-9 w-64 rounded-md border border-border bg-surface px-3 text-sm text-ink"
      />

      <select
        value={searchParams.get("status") ?? "all"}
        onChange={(event) => updateParam("status", event.target.value)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
      >
        {STATUS_FILTERS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("classSection") ?? ""}
        onChange={(event) => updateParam("classSection", event.target.value)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
      >
        <option value="">All classes</option>
        {classSections.map((classSection) => (
          <option key={classSection} value={classSection}>
            {classSection}
          </option>
        ))}
      </select>
    </div>
  );
}
