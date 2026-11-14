"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { METHOD_LABELS, MONEY_METHODS } from "@/lib/domain/money";
import { MONTH_NAMES } from "@/lib/domain/expense-month";
import {
  CalendarIcon,
  FilterIcon,
  WalletIcon,
} from "@/components/shell/nav-icons";
import { Select } from "@/components/forms/select";
import { DateField } from "@/components/forms/date-field";
import { FilterGroup } from "@/components/shell/filter-menu";
import type { ExpenseCategoryOption } from "@/lib/records/expense-directory";

const METHOD_FILTER_LABELS: Record<string, string> = {
  all: "All methods",
  ...METHOD_LABELS,
};

// Search lives outside this panel (see SearchField, rendered to the left of
// the Filters button) -- everything here is a plain icon-in-trigger Select or
// a DateField. Year is a calendar year (2026, 2027) and Month is January to
// December with no year attached, since the Year filter supplies it: Year
// 2026 + Month November is November 2026.
export function ExpenseFilters({
  categories,
  years,
  year,
  month,
}: {
  categories: ExpenseCategoryOption[];
  // The years on offer, and the ones actually in effect -- the page decides
  // the defaults (this year, all months), so the selects can't disagree
  // with what the table is showing.
  years: number[];
  year: string;
  month: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
      // A custom range replaces the Month filter, and picking a month
      // replaces a custom range: they answer the same question two ways, so
      // each starts from a clean slate rather than quietly intersecting.
      if (key === "from" || key === "to") params.delete("month");
      if (key === "month") {
        params.delete("from");
        params.delete("to");
      }
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      <FilterGroup label="Year">
        <Select
          ariaLabel="Filter by year"
          icon={<CalendarIcon size={14} />}
          value={year}
          onChange={(next) => updateParam("year", next)}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          className="w-full"
        />
      </FilterGroup>

      <FilterGroup label="Month">
        <Select
          ariaLabel="Filter by month"
          icon={<CalendarIcon size={14} />}
          value={month}
          onChange={(next) => updateParam("month", next)}
          options={[
            { value: "", label: "All months" },
            ...MONTH_NAMES.map((name, index) => ({
              value: String(index + 1),
              label: name,
            })),
          ]}
          className="w-full"
        />
      </FilterGroup>

      <FilterGroup label="Category">
        <Select
          ariaLabel="Filter by category"
          icon={<FilterIcon size={14} />}
          value={searchParams.get("category") ?? ""}
          onChange={(next) => updateParam("category", next)}
          options={[
            { value: "", label: "All categories" },
            ...categories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          ]}
          className="w-full"
        />
      </FilterGroup>

      <FilterGroup label="Paid by">
        <Select
          ariaLabel="Filter by method"
          icon={<WalletIcon size={14} />}
          value={searchParams.get("method") ?? "all"}
          onChange={(next) => updateParam("method", next)}
          options={["all", ...MONEY_METHODS].map((method) => ({
            value: method,
            label: METHOD_FILTER_LABELS[method] ?? method,
          }))}
          className="w-full"
        />
      </FilterGroup>

      <FilterGroup label="Or a custom date range">
        <div className="flex gap-2">
          <DateField
            ariaLabel="From date"
            placeholder="Start date"
            value={searchParams.get("from") ?? ""}
            onChange={(iso) => updateParam("from", iso)}
            className="min-w-0 flex-1"
          />
          <DateField
            ariaLabel="To date"
            placeholder="End date"
            value={searchParams.get("to") ?? ""}
            onChange={(iso) => updateParam("to", iso)}
            className="min-w-0 flex-1"
          />
        </div>
      </FilterGroup>
    </>
  );
}
