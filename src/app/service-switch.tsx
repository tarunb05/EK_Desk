"use client";

import { useId, useRef, useState, type ReactNode } from "react";

const SERVICES = [
  { key: "transport", label: "Transport" },
  { key: "daycare", label: "Daycare" },
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];

// The landing preview's Transport / Daycare pill. Both panels arrive already
// rendered from the server; this only decides which one is shown. Tabs
// semantics with arrow-key movement, so it reads and works like the
// control it looks like.
export function ServiceSwitch({
  transport,
  daycare,
}: {
  transport: ReactNode;
  daycare: ReactNode;
}) {
  const [active, setActive] = useState<ServiceKey>("transport");
  const id = useId();
  const tabRefs = useRef<Record<ServiceKey, HTMLButtonElement | null>>({
    transport: null,
    daycare: null,
  });
  const panels: Record<ServiceKey, ReactNode> = { transport, daycare };

  function select(key: ServiceKey, focus: boolean) {
    setActive(key);
    if (focus) tabRefs.current[key]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const index = SERVICES.findIndex((s) => s.key === active);
    const last = SERVICES.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    select(SERVICES[next]!.key, true);
  }

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Service"
          className="inline-flex rounded-full bg-sand p-1"
        >
          {SERVICES.map((service) => {
            const selected = service.key === active;
            return (
              <button
                key={service.key}
                ref={(el) => {
                  tabRefs.current[service.key] = el;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${service.key}`}
                aria-selected={selected}
                aria-controls={`${id}-panel-${service.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(service.key, false)}
                onKeyDown={onKeyDown}
                className={`h-8 rounded-full px-4 text-sm font-medium transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected
                    ? "bg-accent text-canvas"
                    : "text-ink hover:bg-surface/70"
                }`}
              >
                {service.label}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-ink-secondary">
          2026-27 · All branches
        </span>
      </div>

      {SERVICES.map((service) => (
        <div
          key={service.key}
          role="tabpanel"
          id={`${id}-panel-${service.key}`}
          aria-labelledby={`${id}-tab-${service.key}`}
          hidden={service.key !== active}
        >
          {panels[service.key]}
        </div>
      ))}
    </div>
  );
}
