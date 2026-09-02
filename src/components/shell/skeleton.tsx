// Every page-transition loading state in the app is built from these
// pieces instead of the single generic spinning ring loading.tsx used to
// show everywhere -- each route's own loading.tsx (see the various
// `loading.tsx` files next to each page.tsx) composes them into the shape
// of the actual page underneath, so the transition reads as "this page is
// arriving" rather than a generic wait.
//
// A sweeping shimmer (globals.css's .animate-shimmer), not Tailwind's
// plain animate-pulse opacity fade -- see that class's own comment for why
// this still doesn't run into CLAUDE.md's gradient ban (the swept layer is
// a solid color; a gradient is used only as an alpha mask on it, never as
// a visible color treatment).

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer rounded-md bg-hairline ${className}`}
    />
  );
}

// Wraps a page's skeleton tree with the same role="status"/aria-live
// pattern the old ring used, so screen readers still announce "Loading"
// once instead of reading every individual placeholder block.
export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      {children}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Matches the [Search] [Filters] [Add/Record button] row every list page
// ends up with (see FilterMenu/SearchField) -- `withSearch` omits the
// search box for the two dashboards, which don't have one.
export function ToolbarSkeleton({ withSearch = false }: { withSearch?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {withSearch ? <Skeleton className="h-9 w-56" /> : null}
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

// Matches StatCards' own grid breakpoints exactly (grid-cols-2 / sm:3 /
// lg:6) so the skeleton doesn't reflow differently from the real cards
// when they arrive.
export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="rounded-md border border-hairline bg-surface p-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

// A generic record table: header row + N body rows of column-width bars,
// inside the same bordered/rounded wrapper every real table uses. Column
// widths vary (first widest) purely so it doesn't read as a solid grid.
export function TableSkeleton({
  columns = 6,
  rows = 6,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      <div className="flex h-9 items-center gap-4 border-b border-hairline bg-canvas px-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-2.5 w-12" />
        ))}
      </div>
      <div className="flex flex-col">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex h-10 items-center gap-4 border-b border-hairline px-3 last:border-0"
          >
            {Array.from({ length: columns }, (_, col) => (
              <Skeleton
                key={col}
                className={`h-3 ${col === 0 ? "w-16" : col === 1 ? "w-24" : "w-14"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// The BackLink + h1 + label/field pairs + submit button shape shared by
// every add/edit/payment/void form page (all `max-w-xl`, all a handful of
// stacked fields) -- fieldCount doesn't need to match each form's real
// count exactly, just be plausible.
export function FormSkeleton({ fieldCount = 5 }: { fieldCount?: number }) {
  return (
    <SkeletonPage>
      <div className="max-w-xl">
        <Skeleton className="mb-4 h-3.5 w-24" />
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: fieldCount }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="mt-2 h-10 w-32" />
        </div>
      </div>
    </SkeletonPage>
  );
}

// The student/fee-account detail pages: BackLink + h1 (the student's
// name) + a payment-history table underneath.
export function DetailSkeleton() {
  return (
    <SkeletonPage>
      <div className="max-w-lg">
        <Skeleton className="mb-4 h-3.5 w-24" />
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-hairline bg-surface p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          ))}
        </div>
        <TableSkeleton columns={4} rows={4} />
      </div>
    </SkeletonPage>
  );
}
