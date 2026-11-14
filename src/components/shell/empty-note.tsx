import { StatusIcon } from "./nav-icons";

// The card a list or page shows when it has nothing in it: the sentence
// that says what will appear here (or what to do next) set in a surface
// card with a small mark, instead of a bare line of grey text floating on
// the canvas where it reads as a page that failed to load.
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface px-4 py-5 md:px-5">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand text-ink-secondary"
      >
        <StatusIcon size={16} />
      </span>
      <p className="max-w-prose pt-1.5 text-sm text-ink-secondary">
        {children}
      </p>
    </div>
  );
}
