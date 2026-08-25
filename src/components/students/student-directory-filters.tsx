"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  STUDENT_SERVICE_FILTERS,
  STUDENT_STATUS_FILTERS,
} from "@/lib/shell/student-table-params";
import type { AcademicYearOption } from "@/lib/shell/resolve-year-branch";
import {
  CalendarIcon,
  ClassIcon,
  SearchIcon,
  ServiceIcon,
  StatusIcon,
} from "@/components/shell/nav-icons";
import { Select } from "@/components/forms/select";

interface StudentDirectoryFiltersProps {
  classSections: string[];
  academicYears: AcademicYearOption[];
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
  "h-9 rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

// Native <select>/<input> elements can't take a child node, so the leading
// icon is an absolutely-positioned overlay in a relative wrapper instead —
// aria-hidden, purely decorative; the accessible name still comes from
// each control's own aria-label/placeholder.
const iconWrapperClassName =
  "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted";

export function StudentDirectoryFilters({
  classSections,
  academicYears,
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
    <>
      <div className="relative w-72">
        <span className={iconWrapperClassName}>
          <SearchIcon size={14} />
        </span>
        <input
          type="search"
          aria-label="Search by name or admission number"
          placeholder="Search by name or admission number"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(event) => updateParam("q", event.target.value)}
          className={`w-full ${controlClassName}`}
        />
      </div>

      <Select
        ariaLabel="Filter by status"
        icon={<StatusIcon size={14} />}
        value={searchParams.get("status") ?? "active"}
        onChange={(next) => updateParam("status", next)}
        options={STUDENT_STATUS_FILTERS.map((status) => ({
          value: status,
          label: STATUS_LABELS[status],
        }))}
        className="w-44"
      />

      <Select
        ariaLabel="Filter by service"
        icon={<ServiceIcon size={14} />}
        value={searchParams.get("service") ?? "all"}
        onChange={(next) => updateParam("service", next)}
        options={STUDENT_SERVICE_FILTERS.map((service) => ({
          value: service,
          label: SERVICE_LABELS[service],
        }))}
        className="w-44"
      />

      <Select
        ariaLabel="Filter by class"
        icon={<ClassIcon size={14} />}
        value={searchParams.get("classSection") ?? ""}
        onChange={(next) => updateParam("classSection", next)}
        options={[
          { value: "", label: "All classes" },
          ...classSections.map((classSection) => ({
            value: classSection,
            label: classSection,
          })),
        ]}
        className="w-40"
      />

      <Select
        ariaLabel="Filter by academic year"
        icon={<CalendarIcon size={14} />}
        value={
          searchParams.get("academicYear") ??
          academicYears.find((year) => year.isCurrent)?.label ??
          "all"
        }
        onChange={(next) => updateParam("academicYear", next)}
        options={[
          { value: "all", label: "All years" },
          ...academicYears.map((year) => ({
            value: year.label,
            label: year.label,
          })),
        ]}
        className="w-36"
      />
    </>
  );
}
