import Link from "next/link";

const disabledClassName =
  "rounded-md border border-border px-3 py-1 text-ink-muted opacity-40";
const enabledClassName =
  "rounded-md border border-border px-3 py-1 transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";

// Keyset pagination only ever moves one direction from a given cursor --
// there is no "page 3 of 12" to jump around in the way OFFSET's
// PaginationControls offers, since a cursor only knows "everything before
// this row." Newer goes back to the top of the *current* filtered view
// (same params, no cursor); Older steps forward with the next cursor.
// Anything in between is the browser's own back button, which already
// works here since every step is a real URL with its own cursor.
export function KeysetPaginationControls({
  hasCursor,
  nextCursor,
  searchParams,
}: {
  hasCursor: boolean;
  nextCursor: string | null;
  searchParams: Record<string, string | undefined>;
}) {
  if (!hasCursor && !nextCursor) return null;

  function hrefWithCursor(cursor: string | null): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && key !== "cursor") params.set(key, value);
    }
    if (cursor) params.set("cursor", cursor);
    const query = params.toString();
    return query ? `/logs?${query}` : "/logs";
  }

  return (
    <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3 text-sm text-ink-secondary">
      {hasCursor ? (
        <Link href={hrefWithCursor(null)} className={enabledClassName}>
          Newer
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClassName}>
          Newer
        </span>
      )}
      {nextCursor ? (
        <Link href={hrefWithCursor(nextCursor)} className={enabledClassName}>
          Older
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClassName}>
          Older
        </span>
      )}
    </div>
  );
}
