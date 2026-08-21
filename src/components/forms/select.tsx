"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "@/components/shell/nav-icons";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  // Accessible name when there's no visible <label> pointing at this control
  // (the filter bar's Status/Service/Class dropdowns render only the
  // selected value, no separate label text).
  ariaLabel?: string;
  icon?: React.ReactNode;
  // Mirrors the value into a hidden input so this still participates in a
  // native form's FormData on submit — the custom listbox itself isn't a
  // form control, so plain <select name="..."> semantics don't carry over
  // for free.
  name?: string;
  className?: string;
  triggerClassName?: string;
}

// A hand-built listbox, not a native <select> — <select>'s open option list
// is OS-rendered chrome that CSS can't restyle cross-browser, which is
// exactly what made the native controls look inconsistent with the rest of
// the app. Follows the ARIA APG "Collapsible Dropdown Listbox" pattern:
// focus stays on the trigger button the whole time, aria-activedescendant
// points at the highlighted option, arrow keys move it, Enter/Space commits.
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  icon,
  name,
  className = "",
  triggerClassName = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listboxId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedLabel = options[selectedIndex]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

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
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      optionRefs.current[highlighted]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlighted]);

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlighted((current) => Math.min(current + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlighted((current) => Math.max(current - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setHighlighted(0);
        break;
      case "End":
        event.preventDefault();
        setHighlighted(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(highlighted);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listboxId}-${highlighted}` : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={handleKeyDown}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent ${triggerClassName}`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {icon}
          {selectedLabel}
        </span>
        <ChevronDownIcon
          size={14}
          className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          className="animate-pop-in absolute left-0 z-20 mt-1 max-h-64 w-full min-w-max overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-[0_1px_2px_rgba(0,0,0,.05)]"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listboxId}-${index}`}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => commit(index)}
              className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                index === highlighted
                  ? "bg-surface-accent text-ink"
                  : "text-ink"
              } ${option.value === value ? "font-medium" : ""}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
