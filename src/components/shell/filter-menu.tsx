"use client";

import { useEffect, useRef, useState } from "react";
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
        className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
      >
        <FilterIcon size={14} />
        Filters
        {activeCount ? (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-md bg-accent px-1 text-2xs font-medium text-surface">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-pop-in absolute right-0 z-30 mt-1 flex w-80 origin-top-right flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.05)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
