"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface MonthFilterProps {
  availableMonths: string[];
}

// Scopes only the Total collected / Collection rate stat cards to the
// selected month(s) — Receivable/Pending/Overdue are point-in-time
// balances, not sums over a date range, so filtering them by month
// wouldn't mean anything. A plain <select multiple> requires ctrl/cmd-click
// to pick more than one option, which isn't discoverable, so this is a
// small custom checkbox popover instead.
export function MonthFilter({ availableMonths }: MonthFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const selected = new Set(
    (searchParams.get("months") ?? "").split(",").filter(Boolean),
  );

  function applySelection(next: Set<string>) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.size > 0) {
      params.set("months", [...next].sort().join(","));
    } else {
      params.delete("months");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleMonth(month: string) {
    const next = new Set(selected);
    if (next.has(month)) {
      next.delete(month);
    } else {
      next.add(month);
    }
    applySelection(next);
  }

  const label =
    selected.size === 0
      ? "All months"
      : `${selected.size} month${selected.size > 1 ? "s" : ""} selected`;

  if (availableMonths.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-label="Filter collected figures by month"
        className="h-8 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        Months: {label}
      </button>

      {open ? (
        <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-border bg-surface p-2">
          <div className="mb-1 flex justify-between border-b border-hairline pb-1 text-2xs">
            <button
              type="button"
              onClick={() => applySelection(new Set())}
              className="text-accent hover:underline"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => applySelection(new Set(availableMonths))}
              className="text-accent hover:underline"
            >
              Select all
            </button>
          </div>
          <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
            {availableMonths.map((month) => (
              <label
                key={month}
                className="flex items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-surface-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.has(month)}
                  onChange={() => toggleMonth(month)}
                />
                {month}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
