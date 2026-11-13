"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatMonthLabel } from "@/lib/domain/expense-month";
import { CalendarIcon } from "@/components/shell/nav-icons";
import { Select } from "@/components/forms/select";

// Always visible next to Search rather than inside the Filters panel: going
// month by month is the thing this page gets used for. `months` are the
// "YYYY-MM" keys of the selected academic year, so the list changes with the
// Year selector.
export function ExpenseMonthFilter({ months }: { months: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(month: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (month) {
      params.set("month", month);
    } else {
      params.delete("month");
    }
    // A month and a custom From/To range answer the same question two ways;
    // picking a month starts from a clean slate rather than quietly
    // intersecting with a range set earlier.
    params.delete("from");
    params.delete("to");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      ariaLabel="Filter by month"
      icon={<CalendarIcon size={14} />}
      value={searchParams.get("month") ?? ""}
      onChange={handleChange}
      options={[
        { value: "", label: "All months" },
        ...months.map((month) => ({
          value: month,
          label: formatMonthLabel(month),
        })),
      ]}
      className="w-48"
    />
  );
}
