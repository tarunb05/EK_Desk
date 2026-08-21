export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-secondary">
      {label}
      {children}
    </label>
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
