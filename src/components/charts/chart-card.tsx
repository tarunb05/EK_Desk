// The frame every chart in the app sits in: a surface card with the same
// 11px uppercase section label the tables use, an optional one-line caption
// on the right, and the chart below. Charts never draw their own border or
// title -- they all get this one, so a row of them lines up.
export function ChartCard({
  title,
  caption,
  className = "",
  children,
}: {
  title: string;
  caption?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`hover-card scroll-reveal flex min-w-0 flex-col gap-4 rounded-lg border border-hairline bg-surface p-4 md:p-5 ${className}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-2xs font-medium uppercase tracking-[0.06em] text-ink-muted">
          {title}
        </h2>
        {caption ? (
          <p className="text-xs text-ink-secondary">{caption}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

// Swatch + name, in mark order. Text stays in ink tokens -- the swatch is
// what carries the colour, never the label.
export function ChartLegend({
  items,
}: {
  items: { label: string; swatch: string; detail?: string }[];
}) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-secondary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${item.swatch}`}
          />
          <span>{item.label}</span>
          {item.detail ? (
            <span className="font-medium tabular-nums text-ink">
              {item.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// What a chart shows when its scope has nothing in it yet -- a sentence
// that says what to do next, same rule as every table's empty state.
export function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-sm text-ink-muted">{children}</p>;
}
