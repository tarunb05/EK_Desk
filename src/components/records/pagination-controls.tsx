import Link from "next/link";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

const disabledClassName =
  "rounded-md border border-border px-3 py-1 text-ink-muted opacity-40";
const enabledClassName =
  "rounded-md border border-border px-3 py-1 transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";

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

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <div className="flex items-center justify-between border-t border-hairline pt-3 text-sm text-ink-secondary">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {isFirstPage ? (
          <span aria-disabled="true" className={disabledClassName}>
            Previous
          </span>
        ) : (
          <Link href={hrefForPage(page - 1)} className={enabledClassName}>
            Previous
          </Link>
        )}
        {isLastPage ? (
          <span aria-disabled="true" className={disabledClassName}>
            Next
          </span>
        ) : (
          <Link href={hrefForPage(page + 1)} className={enabledClassName}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
