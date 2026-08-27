"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "./nav-icons";

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  // "Delete"/"Request deletion" reads in --attention, matching every other
  // destructive/warning control in the app (overdue figures, void, etc.).
  destructive?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  disabled?: boolean;
  triggerLabel?: string;
}

// A per-row menu, not a value-holding form control -- the table version of
// this used to be a plain <select> for exactly that reason, but a native
// <select>'s open list is OS-rendered chrome CSS can't restyle (same
// problem Select in components/forms solved for real filter dropdowns).
// This can't reuse Select's own absolute-positioned panel, though: it
// lives inside the record table's `overflow-x-auto` wrapper, and per the
// CSS overflow spec, setting only overflow-x forces overflow-y to
// `auto` too -- an absolutely-positioned panel opening below a row near
// the table's bottom edge would get silently clipped. Rendered through a
// portal into <body> instead, positioned from the trigger's own
// getBoundingClientRect(), so it's never subject to any ancestor's
// overflow/clipping.
export function ActionMenu({
  items,
  disabled = false,
  triggerLabel = "Actions",
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    place();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    // Closes rather than tracks the trigger through a scroll -- this is a
    // quick per-row action, not a control worth the complexity of staying
    // pinned to a moving target.
    function handleDismiss() {
      setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-2xs text-ink-secondary outline-none transition-colors hover:bg-surface-accent hover:text-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
      >
        {triggerLabel}
        <ChevronDownIcon
          size={12}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{ top: position.top, right: position.right }}
              className="animate-pop-in fixed z-30 w-40 origin-top-right rounded-md border border-border bg-surface p-1 shadow-[0_1px_2px_rgba(0,0,0,.05)]"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-accent ${
                    item.destructive ? "text-attention" : "text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
