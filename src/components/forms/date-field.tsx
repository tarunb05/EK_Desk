"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { inputClassName } from "@/components/forms/field";

interface DateFieldProps {
  // Uncontrolled/form mode: renders a hidden input so this participates in
  // a plain <form action={...}> the same way the native <input type="date">
  // it replaces did -- the Server Action's formEntries(formData) parsing
  // needs no changes either way.
  name?: string;
  defaultValue?: string;
  required?: boolean;
  // Controlled mode: the expense-filters date-range fields drive the URL's
  // search params directly rather than a form submission.
  value?: string;
  onChange?: (isoDate: string) => void;
  ariaLabel?: string;
  className?: string;
  // Activity log's Day filter: disabled until a month is chosen ("which
  // day" only means something once "which month" has narrowed the range),
  // and minDate/maxDate clamp the popover to that month once one is --
  // real Date bounds rather than the native <input>'s min/max strings,
  // which this replaces.
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  // Every from/to pair (Expenses, the Students directory, the Activity
  // log) passes this as "Start date"/"End date" so an empty field reads as
  // which end of the range it is, not a generic "Pick a date" that leaves
  // that to the field's label alone. Defaults to the old generic copy for
  // any single, non-range date field (Due date, Starts on, Paid on...).
  placeholder?: string;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" parsed as local calendar date, not UTC midnight -- new
// Date("2026-04-01") is UTC midnight, which renders as the 31st in any
// timezone behind UTC. Splitting into components and using the local Date
// constructor avoids that off-by-one.
function fromIso(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Same trigger-button + popover + outside-click shape as the app's other
// custom dropdown (components/forms/select.tsx) -- this is that pattern
// applied to a date instead of a fixed option list, backed by the pasted
// Calendar component for the actual month grid.
export function DateField({
  name,
  defaultValue,
  required,
  value,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
  minDate,
  maxDate,
  placeholder = "Pick a date",
}: DateFieldProps) {
  const isControlled = value !== undefined;
  const [open, setOpen] = useState(false);
  const [internalIso, setInternalIso] = useState(defaultValue ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  const currentIso = isControlled ? value : internalIso;
  const selectedDate = currentIso ? fromIso(currentIso) : undefined;

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

  // Guards the Activity log's Day field: clearing the Month filter flips
  // this to disabled while the popover might still be open.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function handleSelect(date: Date) {
    const iso = toIso(date);
    if (isControlled) {
      onChange?.(iso);
    } else {
      setInternalIso(iso);
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name ? (
        <input type="hidden" name={name} value={currentIso} required={required} />
      ) : null}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`flex w-full items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 ${inputClassName} ${
          selectedDate ? "" : "text-ink-muted"
        }`}
      >
        <CalendarIcon size={14} className="shrink-0 text-ink-muted" />
        <span className="truncate">
          {selectedDate ? formatDisplay(selectedDate) : placeholder}
        </span>
      </button>

      {open && !disabled ? (
        // Calendar's own w-full needs a concrete width to fill -- an
        // absolutely positioned parent with no width set collapses to its
        // content's intrinsic size, which left the 7-column day grid
        // squeezed narrower than its own fixed-size day buttons (they
        // don't shrink, so they overlapped instead).
        <div className="absolute left-0 z-20 mt-1 w-80">
          <Calendar
            selected={selectedDate}
            onSelect={handleSelect}
            minDate={minDate}
            maxDate={maxDate}
          />
        </div>
      ) : null}
    </div>
  );
}
