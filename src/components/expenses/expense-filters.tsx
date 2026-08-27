"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONEY_METHODS } from "@/lib/domain/money";
import { FilterIcon, WalletIcon } from "@/components/shell/nav-icons";
import { Select } from "@/components/forms/select";
import type { ExpenseCategoryOption } from "@/lib/records/expense-directory";

const METHOD_LABELS: Record<string, string> = {
  all: "All methods",
  cash: "Cash",
  upi: "UPI",
  cheque: "Cheque",
  bank_transfer: "Bank transfer",
};

const inputClassName =
  "h-9 rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

// Search lives outside this panel now (see SearchField, rendered to the
// left of the Filters button) -- everything left here is a plain
// icon-in-trigger Select or a plain date input.
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
        <input
          type="date"
          aria-label="From date"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(event) => updateParam("from", event.target.value)}
          className={`${inputClassName} min-w-0 flex-1 pl-3`}
        />
        <input
          type="date"
          aria-label="To date"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(event) => updateParam("to", event.target.value)}
          className={`${inputClassName} min-w-0 flex-1 pl-3`}
        />
      </div>
    </>
  );
}
