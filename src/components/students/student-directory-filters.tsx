"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  STUDENT_SERVICE_FILTERS,
  STUDENT_STATUS_FILTERS,
} from "@/lib/shell/student-table-params";

interface StudentDirectoryFiltersProps {
  classSections: string[];
}

const STATUS_LABELS: Record<(typeof STUDENT_STATUS_FILTERS)[number], string> = {
  active: "Active",
  inactive: "Deleted",
  overdue: "Overdue",
  pending: "Pending",
  paid: "Paid",
  all: "All students",
};

const SERVICE_LABELS: Record<(typeof STUDENT_SERVICE_FILTERS)[number], string> =
  {
    all: "Transport + Daycare",
    transport: "Transport only",
    daycare: "Daycare only",
  };

const controlClassName =
  "h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

export function StudentDirectoryFilters({
  classSections,
}: StudentDirectoryFiltersProps) {
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
        aria-label="Search by name or admission number"
        placeholder="Search by name or admission number"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(event) => updateParam("q", event.target.value)}
        className={`w-72 ${controlClassName}`}
      />

      <select
        aria-label="Filter by status"
        value={searchParams.get("status") ?? "active"}
        onChange={(event) => updateParam("status", event.target.value)}
        className={controlClassName}
      >
        {STUDENT_STATUS_FILTERS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by service"
        value={searchParams.get("service") ?? "all"}
        onChange={(event) => updateParam("service", event.target.value)}
        className={controlClassName}
      >
        {STUDENT_SERVICE_FILTERS.map((service) => (
          <option key={service} value={service}>
            {SERVICE_LABELS[service]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by class"
        value={searchParams.get("classSection") ?? ""}
        onChange={(event) => updateParam("classSection", event.target.value)}
        className={controlClassName}
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
