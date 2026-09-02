"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Adapted from the shadcn-style reference the user pasted -- re-themed onto
// this app's tokens (see select.tsx's comment for the --accent/--primary
// naming collision this also has to navigate: "selected day" uses this
// app's real --accent, "today"/hover use --surface-accent, the existing
// hover tint, not a second brand color). Filename fixed from the pasted
// "calender.tsx" typo. Radius capped at rounded-md (6px, CLAUDE.md's
// ceiling) instead of the reference's rounded-ele.

const calendarVariants = cva(
  "inline-block w-full max-w-sm space-y-3 rounded-md border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,.05)]",
  {
    variants: {
      size: {
        sm: "p-2 text-sm",
        default: "p-3",
        lg: "p-4 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const dayVariants = cva(
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "text-ink hover:bg-surface-accent",
        selected: "bg-accent font-medium text-surface hover:bg-accent/90",
        today: "bg-surface-accent font-medium text-ink hover:bg-surface-accent/70",
        outside: "text-ink-muted opacity-50 hover:bg-surface-accent",
        disabled: "text-ink-muted opacity-30",
        "range-start": "rounded-r-none bg-accent text-surface hover:bg-accent/90",
        "range-end": "rounded-l-none bg-accent text-surface hover:bg-accent/90",
        "range-middle": "rounded-none bg-accent/20 text-ink hover:bg-accent/30",
      },
      size: {
        sm: "h-7 w-7 text-xs",
        default: "h-8 w-8 text-sm",
        lg: "h-9 w-9 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface CalendarProps extends VariantProps<typeof calendarVariants> {
  selected?: Date;
  onSelect?: (date: Date) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
  showOutsideDays?: boolean;
  minDate?: Date;
  maxDate?: Date;
  mode?: "single" | "multiple" | "range";
  selectedDates?: Date[];
  selectedRange?: { from: Date; to?: Date };
  onSelectMultiple?: (dates: Date[]) => void;
  onSelectRange?: (range: { from: Date; to?: Date }) => void;
  showMonthYearPickers?: boolean;
}

type DayVariant =
  | "default"
  | "selected"
  | "today"
  | "outside"
  | "disabled"
  | "range-start"
  | "range-end"
  | "range-middle";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

export function Calendar({
  selected,
  onSelect,
  disabled,
  className,
  size,
  showOutsideDays = true,
  minDate,
  maxDate,
  mode = "single",
  selectedDates = [],
  selectedRange,
  onSelectMultiple,
  onSelectRange,
  showMonthYearPickers = false,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = React.useState(selected ?? new Date());
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [direction, setDirection] = React.useState<"left" | "right">("right");
  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const yearRange = React.useMemo(
    () => Array.from({ length: 21 }, (_, i) => currentYear - 10 + i),
    [currentYear],
  );

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  const prevMonthDays = Array.from(
    { length: firstDayOfWeek },
    (_, i) => prevMonthLastDay - firstDayOfWeek + i + 1,
  );

  const totalCells = 42;
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const remainingCells = totalCells - prevMonthDays.length - currentMonthDays.length;
  const nextMonthDays = Array.from({ length: remainingCells }, (_, i) => i + 1);

  function navigateMonth(dir: "prev" | "next") {
    setIsAnimating(true);
    setDirection(dir === "prev" ? "left" : "right");
    setTimeout(() => {
      const newDate = new Date(currentDate);
      newDate.setMonth(currentMonth + (dir === "prev" ? -1 : 1));
      setCurrentDate(newDate);
      setIsAnimating(false);
    }, 150);
  }

  function handleMonthChange(month: string) {
    const newDate = new Date(currentDate);
    newDate.setMonth(parseInt(month, 10));
    setCurrentDate(newDate);
  }

  function handleYearChange(year: string) {
    const newDate = new Date(currentDate);
    newDate.setFullYear(parseInt(year, 10));
    setCurrentDate(newDate);
  }

  function isDateDisabled(date: Date) {
    if (disabled?.(date)) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }

  function isDateSelected(date: Date) {
    if (mode === "single") return selected ? isSameDay(date, selected) : false;
    if (mode === "multiple") return selectedDates.some((d) => isSameDay(d, date));
    if (mode === "range" && selectedRange) {
      if (!selectedRange.to) return isSameDay(date, selectedRange.from);
      const t = date.getTime();
      return t >= selectedRange.from.getTime() && t <= selectedRange.to.getTime();
    }
    return false;
  }

  function isDateInRange(date: Date) {
    if (mode === "range" && selectedRange?.to) {
      const t = date.getTime();
      return t > selectedRange.from.getTime() && t < selectedRange.to.getTime();
    }
    return false;
  }

  function isToday(date: Date) {
    return isSameDay(date, today);
  }

  function handleDateClick(day: number, monthOffset = 0) {
    const clicked = new Date(currentYear, currentMonth + monthOffset, day);
    if (isDateDisabled(clicked)) return;

    if (mode === "single") {
      onSelect?.(clicked);
    } else if (mode === "multiple") {
      const next = selectedDates.some((d) => isSameDay(d, clicked))
        ? selectedDates.filter((d) => !isSameDay(d, clicked))
        : [...selectedDates, clicked];
      onSelectMultiple?.(next);
    } else if (mode === "range") {
      if (!selectedRange || (selectedRange.from && selectedRange.to)) {
        onSelectRange?.({ from: clicked });
      } else {
        const from = selectedRange.from <= clicked ? selectedRange.from : clicked;
        const to = selectedRange.from <= clicked ? clicked : selectedRange.from;
        onSelectRange?.({ from, to });
      }
    }
  }

  // Day buttons showed only the bare number ("1", "2"...) with nothing
  // distinguishing e.g. an outside-month "1" from the current month's own
  // "1" -- a screen reader announced them identically, and nothing let a
  // test target an exact date without first inspecting which grid position
  // was which. A real date in the label fixes both at once.
  function dayAriaLabel(day: number, monthOffset = 0): string {
    const date = new Date(currentYear, currentMonth + monthOffset, day);
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function getDayVariant(day: number, monthOffset = 0): DayVariant {
    const date = new Date(currentYear, currentMonth + monthOffset, day);
    if (isDateDisabled(date)) return "disabled";
    if (mode === "range" && selectedRange) {
      if (isSameDay(date, selectedRange.from)) return "range-start";
      if (selectedRange.to && isSameDay(date, selectedRange.to)) return "range-end";
      if (isDateInRange(date)) return "range-middle";
    }
    if (isDateSelected(date)) return "selected";
    if (isToday(date)) return "today";
    if (monthOffset !== 0) return "outside";
    return "default";
  }

  const slideVariants = {
    enter: (dir: string) => ({ x: dir === "right" ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: string) => ({ x: dir === "right" ? -40 : 40, opacity: 0 }),
  };

  return (
    <div className={cn(calendarVariants({ size }), className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateMonth("prev")}
          disabled={isAnimating}
          aria-label="Previous month"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          {showMonthYearPickers ? (
            <div className="flex items-center gap-1.5">
              <Select value={String(currentMonth)} onValueChange={handleMonthChange}>
                <SelectTrigger size="sm" className="h-7 w-[108px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(currentYear)} onValueChange={handleYearChange}>
                <SelectTrigger size="sm" className="h-7 w-[76px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearRange.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <span
              data-testid="calendar-month-year"
              className="text-sm font-medium text-ink"
            >
              {MONTHS[currentMonth]} {currentYear}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigateMonth("next")}
          disabled={isAnimating}
          aria-label="Next month"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="flex h-7 items-center justify-center text-2xs font-medium uppercase tracking-wide text-ink-muted"
          >
            {day.slice(0, 1)}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${currentMonth}-${currentYear}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.15 }}
            className="grid grid-cols-7 gap-1"
          >
            {showOutsideDays &&
              prevMonthDays.map((day) => (
                <button
                  key={`prev-${day}`}
                  type="button"
                  onClick={() => handleDateClick(day, -1)}
                  disabled={isDateDisabled(new Date(currentYear, currentMonth - 1, day))}
                  aria-label={dayAriaLabel(day, -1)}
                  className={dayVariants({ variant: getDayVariant(day, -1), size })}
                >
                  {day}
                </button>
              ))}
            {currentMonthDays.map((day) => (
              <button
                key={`current-${day}`}
                type="button"
                onClick={() => handleDateClick(day)}
                disabled={isDateDisabled(new Date(currentYear, currentMonth, day))}
                aria-label={dayAriaLabel(day)}
                className={dayVariants({ variant: getDayVariant(day), size })}
              >
                {day}
              </button>
            ))}
            {showOutsideDays &&
              nextMonthDays.map((day) => (
                <button
                  key={`next-${day}`}
                  type="button"
                  onClick={() => handleDateClick(day, 1)}
                  disabled={isDateDisabled(new Date(currentYear, currentMonth + 1, day))}
                  aria-label={dayAriaLabel(day, 1)}
                  className={dayVariants({ variant: getDayVariant(day, 1), size })}
                >
                  {day}
                </button>
              ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
