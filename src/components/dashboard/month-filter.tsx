"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
} from "@/components/shell/nav-icons";
import { usePopoverPlacement } from "@/components/forms/use-popover-placement";

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
// the year; sorting by month name is what actually reads naturally here,
// and it is the same order the Expenses page's Month dropdown uses.
function byCalendarMonth(a: string, b: string): number {
  return monthNumber(a) - monthNumber(b);
}

// Scopes only the Total collected / Collection rate stat cards (and the
// monthly chart's highlight) to the selected month(s) — Receivable/Pending/
// Overdue are point-in-time balances, not sums over a date range, so
// filtering them by month wouldn't mean anything.
//
// Deliberately the same control as components/forms/select.tsx to look at:
// the same trigger, the same list, the same row, the same trailing tick on
// what is chosen. The only difference is that more than one row can be
// ticked and the list stays open while you tick them. It used to be a
// narrower box of native browser checkboxes hanging off the right edge,
// which made "pick a month" look like a different kind of control here
// than on Expenses.
export function MonthFilter({ availableMonths }: MonthFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const placement = usePopoverPlacement(containerRef, open, { height: 264 });

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
        : `${selected.size} months`;

  if (availableMonths.length === 0) {
    return null;
  }

  const rowClassName =
    "flex w-full cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-sm px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface-accent focus-visible:bg-surface-accent focus-visible:outline-none";

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Filter collected figures by month"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex items-center gap-1.5 truncate">
          <CalendarIcon size={14} />
          {label}
        </span>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Months"
          style={placement}
          className="animate-pop-in absolute left-0 z-30 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-[0_1px_2px_rgba(0,0,0,.05)]"
        >
          {/* "All months" is a row like any other -- ticked when nothing is
              narrowed -- rather than a separate Clear / Select all bar. */}
          <button
            type="button"
            role="option"
            aria-selected={selected.size === 0}
            onClick={() => applySelection(new Set())}
            className={`${rowClassName} ${selected.size === 0 ? "font-medium" : ""}`}
          >
            All months
            <CheckIcon
              size={14}
              className={selected.size === 0 ? "text-accent" : "invisible"}
            />
          </button>
          {[...availableMonths].sort(byCalendarMonth).map((month) => {
            const isSelected = selected.has(month);
            return (
              <button
                key={month}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleMonth(month)}
                className={`${rowClassName} ${isSelected ? "font-medium" : ""}`}
              >
                {monthName(month)}
                <CheckIcon
                  size={14}
                  className={isSelected ? "text-accent" : "invisible"}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
