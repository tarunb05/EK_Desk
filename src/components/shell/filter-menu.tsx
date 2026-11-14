"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterIcon } from "./nav-icons";

// Every page's filters (ScopeSelectors, StudentDirectoryFilters,
// ExpenseFilters, MonthFilter) used to sit loose in a row under the page
// title, which pushed onto a second line on anything narrower than a wide
// desktop once a page had more than two or three of them (Students,
// Expenses). This is a single trigger + popover that holds all of them
// instead -- each filter component is unchanged in *behavior* (still
// reads/writes the URL search params the same way), only in *where* it
// renders. Search is the one exception, deliberately kept outside (see
// SearchField) since it's reached for far more often than the rest.
// Follows the same outside-click/Escape-to-close pattern as Select and
// MonthFilter.
export function FilterMenu({
  children,
  activeCount,
}: {
  children: React.ReactNode;
  // Shown as a small count next to the label -- "the right affordance"
  // for a panel holding several filters at once (the activity log, phase
  // 12.3), so it's clear at a glance whether anything is narrowing the
  // list without opening the panel to check. Omitted (not zero) on every
  // other page's FilterMenu, which never asked for one.
  activeCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Anything in the query string is a filter, sort or search on this page
  // (the URL is the only place they live), so "is there a query string"
  // is exactly "is there anything to reset".
  const hasParams = searchParams.toString().length > 0;

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
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
      >
        <FilterIcon size={14} />
        Filters
        {activeCount ? (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-medium text-surface">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-pop-in absolute right-0 z-30 mt-1 flex w-80 max-w-[calc(100vw-2rem)] origin-top-right flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.05)]">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <span className="text-sm font-medium text-ink">Filters</span>
            {/* One reset for the whole panel, in the same place on every
                page, instead of each page inventing (or omitting) its own. */}
            <button
              type="button"
              disabled={!hasParams}
              onClick={() => router.push(pathname)}
              className="rounded-full px-2 py-0.5 text-xs text-accent transition-colors hover:bg-surface-accent disabled:text-ink-muted disabled:opacity-60 disabled:hover:bg-transparent"
            >
              Reset all
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}

// A filter control with its name above it. Every control in a FilterMenu
// goes in one of these: the trigger only shows the current value ("All
// branches", "2026"), which does not say what it is filtering until
// something other than the default is picked.
export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
