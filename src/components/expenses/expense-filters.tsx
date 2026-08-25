"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MONEY_METHODS } from "@/lib/domain/money";
import { FilterIcon, SearchIcon, WalletIcon } from "@/components/shell/nav-icons";
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
const iconWrapperClassName =
  "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted";

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
      <div className="relative w-56">
        <span className={iconWrapperClassName}>
          <SearchIcon size={14} />
        </span>
        <input
          type="search"
          aria-label="Search by category, reference, or note"
          placeholder="Search"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(event) => updateParam("q", event.target.value)}
          className={`w-full ${inputClassName}`}
        />
      </div>

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
        className="w-44"
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
        className="w-40"
      />

      <input
        type="date"
        aria-label="From date"
        defaultValue={searchParams.get("from") ?? ""}
        onChange={(event) => updateParam("from", event.target.value)}
        className={`${inputClassName} pl-3 w-36`}
      />
      <input
        type="date"
        aria-label="To date"
        defaultValue={searchParams.get("to") ?? ""}
        onChange={(event) => updateParam("to", event.target.value)}
        className={`${inputClassName} pl-3 w-36`}
      />
    </>
  );
}
