"use client";

import { TableNavLink } from "@/components/records/table-transition";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

const disabledClassName =
  "rounded-md border border-border px-3 py-1 text-ink-muted opacity-40";
const enabledClassName =
  "rounded-md border border-border px-3 py-1 transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
const pageNumberClassName =
  "flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent";

// A window of 1 … current-1, current, current+1 … totalPages, collapsing
// the ellipsis away once the run of numbers on either side reaches the end.
function pageNumbersToShow(page: number, totalPages: number): (number | "…")[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) {
      result.push("…");
    }
    result.push(sorted[i]!);
  }
  return result;
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

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <div className="flex items-center justify-between border-t border-hairline pt-3 text-sm text-ink-secondary">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {isFirstPage ? (
          <span aria-disabled="true" className={disabledClassName}>
            Previous
          </span>
        ) : (
          <TableNavLink
            href={hrefForPage(page - 1)}
            className={enabledClassName}
          >
            Previous
          </TableNavLink>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center gap-1" aria-label="Page navigation">
            {pageNumbersToShow(page, totalPages).map((entry, index) =>
              entry === "…" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-ink-muted"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : entry === page ? (
                <span
                  key={entry}
                  aria-current="page"
                  className={`${pageNumberClassName} bg-surface-accent font-medium text-ink`}
                >
                  {entry}
                </span>
              ) : (
                <TableNavLink
                  key={entry}
                  href={hrefForPage(entry)}
                  aria-label={`Page ${entry}`}
                  className={`${pageNumberClassName} text-ink-secondary hover:bg-surface-accent hover:text-ink`}
                >
                  {entry}
                </TableNavLink>
              ),
            )}
          </div>
        ) : null}

        {isLastPage ? (
          <span aria-disabled="true" className={disabledClassName}>
            Next
          </span>
        ) : (
          <TableNavLink
            href={hrefForPage(page + 1)}
            className={enabledClassName}
          >
            Next
          </TableNavLink>
        )}
      </div>
    </div>
  );
}
