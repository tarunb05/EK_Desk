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
  "h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-accent";
