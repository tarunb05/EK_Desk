import Link from "next/link";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

export function PaginationControls({
  page,
  totalPages,
  searchParams,
}: PaginationControlsProps) {
  function hrefForPage(targetPage: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-between border-t border-hairline pt-3 text-sm text-ink-secondary">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={hrefForPage(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`rounded-md border border-border px-3 py-1 ${
            page <= 1
              ? "pointer-events-none opacity-40"
              : "hover:bg-surface-accent hover:text-ink"
          }`}
        >
          Previous
        </Link>
        <Link
          href={hrefForPage(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`rounded-md border border-border px-3 py-1 ${
            page >= totalPages
              ? "pointer-events-none opacity-40"
              : "hover:bg-surface-accent hover:text-ink"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
