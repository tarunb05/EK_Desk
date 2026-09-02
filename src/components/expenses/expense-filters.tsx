"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONEY_METHODS } from "@/lib/domain/money";
import { FilterIcon, WalletIcon } from "@/components/shell/nav-icons";
import { Select } from "@/components/forms/select";
import { DateField } from "@/components/forms/date-field";
import type { ExpenseCategoryOption } from "@/lib/records/expense-directory";

const METHOD_LABELS: Record<string, string> = {
  all: "All methods",
  cash: "Cash",
  upi: "UPI",
  cheque: "Cheque",
  bank_transfer: "Bank transfer",
};

// Search lives outside this panel now (see SearchField, rendered to the
// left of the Filters button) -- everything left here is a plain
// icon-in-trigger Select or a DateField.
export function ExpenseFilters({
  categories,
}: {
  categories: ExpenseCategoryOption[];
}) {
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

      <Select
        ariaLabel="Filter by method"
        icon={<WalletIcon size={14} />}
        value={searchParams.get("method") ?? "all"}
        onChange={(next) => updateParam("method", next)}
        options={["all", ...MONEY_METHODS].map((method) => ({
          value: method,
          label: METHOD_LABELS[method] ?? method,
        }))}
        className="w-full"
      />

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
    </>
  );
}
