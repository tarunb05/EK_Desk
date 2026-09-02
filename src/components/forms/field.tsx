// The error sits on the same row as the label, right of it -- next to the
// field's name rather than buried at the bottom of the form past every
// other field and the submit button, where it's disconnected from which box
// is actually the problem.
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-secondary">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {error ? (
          <span
            className="animate-alert-in text-xs font-normal normal-case text-attention"
            role="alert"
          >
            {error}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

// The non-field-specific error (a DB conflict, a permission check) shown
// once at the bottom of a form or row action -- was copy-pasted identically
// (down to the exact class list, in most call sites) across every form and
// row-action component in the app instead of living in one place. `size`
// covers the only real variation: full forms use text-xs, compact row-level
// actions (an inline Actions-menu error, a table row's own error) use
// text-2xs; `className` is for the occasional spacing/width override
// (mt-2, mb-2, w-full) a handful of call sites had.
export function FormError({
  error,
  size = "xs",
  className = "",
}: {
  error: string | null | undefined;
  size?: "xs" | "2xs";
  className?: string;
}) {
  if (!error) return null;
  return (
    <p
      className={`animate-alert-in ${size === "xs" ? "text-xs" : "text-2xs"} text-attention ${className}`}
      role="alert"
    >
      {error}
    </p>
  );
}

export const inputClassName =
  "h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

// Shared by every primary submit button. The scale-down on press is a small,
// tactile confirmation that the click registered — not a hover animation,
// so it only fires on the state change that matters.
const submitButtonBase =
  "h-10 rounded-md text-sm font-medium text-surface transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

export const primaryButtonClassName = `${submitButtonBase} bg-accent hover:bg-accent/90`;
export const dangerButtonClassName = `${submitButtonBase} bg-attention hover:bg-attention/90`;
