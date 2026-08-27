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

// Search lives outside this panel now (see SearchField, rendered to the
// left of the Filters button) -- everything left here is a plain
// icon-in-trigger Select, an occasional-use filter rather than the
// every-visit control search is.
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
      <Select
        ariaLabel="Filter by status"
        icon={<StatusIcon size={14} />}
        value={searchParams.get("status") ?? "active"}
        onChange={(next) => updateParam("status", next)}
        options={STUDENT_STATUS_FILTERS.map((status) => ({
          value: status,
          label: STATUS_LABELS[status],
        }))}
        className="w-full"
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
        className="w-full"
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
        className="w-full"
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
        className="w-full"
      />
    </>
  );
}
