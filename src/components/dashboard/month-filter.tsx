"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, FilterIcon } from "@/components/shell/nav-icons";

interface MonthFilterProps {
  availableMonths: string[];
}

// availableMonths are "YYYY-MM" keys (matching dashboard_collection_by_month
// and the months URL param), but the year is already picked separately via
// the Year selector, so only the month name needs to show here. A given
// academic year's 12-month span never repeats a calendar month, so this is
// unambiguous even though the underlying key still carries the year.
function monthName(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
  });
}

function monthNumber(monthKey: string): number {
  return Number(monthKey.split("-")[1] ?? 0);
}

// Calendar order (Jan–Dec), not chronological — an academic year spans two
// calendar years (e.g. Apr 2026–Mar 2027), so sorting the raw "YYYY-MM"
// keys would list Nov/Dec before Jan/Feb even though Jan/Feb come later in
// the year; sorting by month name is what actually reads naturally here.
function byCalendarMonth(a: string, b: string): number {
  return monthNumber(a) - monthNumber(b);
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Missing entirely before -- every other popover in the app (Select,
  // FilterMenu, ActionMenu) closes on an outside click or Escape; this one
  // only ever toggled from its own trigger, so it stayed open no matter
  // where else on the page you clicked.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
      : selected.size <= 2
        ? [...selected].sort(byCalendarMonth).map(monthName).join(", ")
        : `${selected.size} months selected`;

  if (availableMonths.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-label="Filter collected figures by month"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex items-center gap-1.5 truncate">
          <FilterIcon size={14} />
          {label}
        </span>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="animate-pop-in absolute right-0 z-10 mt-1 w-48 origin-top-right rounded-md border border-border bg-surface p-2 shadow-[0_1px_2px_rgba(0,0,0,.05)]">
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
            {[...availableMonths].sort(byCalendarMonth).map((month) => (
              <label
                key={month}
                className="flex items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-surface-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.has(month)}
                  onChange={() => toggleMonth(month)}
                />
                {monthName(month)}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
