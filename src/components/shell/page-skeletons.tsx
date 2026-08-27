import {
  Skeleton,
  SkeletonPage,
  ToolbarSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "./skeleton";

// Transport & Daycare (ServiceScopeDashboard): title, toolbar (no search
// there), the 6 stat cards, and the "By branch" split table.
export function DashboardLoadingSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-6 w-28" />
      <ToolbarSkeleton />
      <StatCardsSkeleton />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-20" />
        <TableSkeleton columns={7} rows={2} />
      </div>
    </SkeletonPage>
  );
}

// Students: title, toolbar (with search), the directory table (S.No,
// Student, Admission no., Class, Branch, Guardian, Phone, Date added,
// Payment, Actions).
export function StudentsLoadingSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-6 w-24" />
      <ToolbarSkeleton withSearch />
      <TableSkeleton columns={10} rows={8} />
    </SkeletonPage>
  );
}

// Expenses: title, toolbar (with search), the total-expenses card, the
// category-breakdown chart's section label, and the expense table.
export function ExpensesLoadingSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-6 w-24" />
      <ToolbarSkeleton withSearch />
      <div className="rounded-md border border-hairline bg-surface p-4">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-3 h-5 w-28" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-24 w-full" />
      </div>
      <TableSkeleton columns={7} rows={8} />
    </SkeletonPage>
  );
}

// Approvals: title + a bordered, divided list of request rows (each one
// name/detail bar plus approve/reject-shaped controls).
export function ApprovalsLoadingSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-6 w-24" />
      <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-surface">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}

// Settings: title + the same section cards the real page has (academic
// years / branches side by side, then teachers, then the two smaller
// max-w-md cards).
export function SettingsLoadingSkeleton() {
  const sectionRows = (count: number) => (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );

  return (
    <SkeletonPage>
      <Skeleton className="h-6 w-24" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <Skeleton className="h-3.5 w-32" />
          {sectionRows(3)}
          <Skeleton className="h-9 w-full" />
        </section>
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <Skeleton className="h-3.5 w-24" />
          {sectionRows(2)}
          <Skeleton className="h-9 w-full" />
        </section>
      </div>
      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
        <Skeleton className="h-3.5 w-20" />
        {sectionRows(3)}
        <Skeleton className="h-9 w-full" />
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex max-w-md flex-col gap-3 rounded-md border border-border bg-surface p-5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-32" />
        </section>
        <section className="flex max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-9 w-full" />
        </section>
      </div>
    </SkeletonPage>
  );
}

// The (app)-level fallback -- every real route now has its own
// specifically-shaped loading.tsx (see the files next to each page.tsx),
// so this only fires for a route that doesn't yet. A generic list-page
// shape is the closest single guess to "most pages in this app."
export function GenericLoadingSkeleton() {
  return (
    <SkeletonPage>
      <Skeleton className="h-6 w-32" />
      <ToolbarSkeleton />
      <TableSkeleton />
    </SkeletonPage>
  );
}

// Settings > Expense categories: back link + title + a divided list of
// category rows.
export function ExpenseCategoriesLoadingSkeleton() {
  return (
    <SkeletonPage>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-6 w-40" />
      </div>
      <section className="rounded-md border border-border bg-surface p-5">
        <ul className="flex flex-col divide-y divide-hairline">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center justify-between py-2.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-12" />
            </li>
          ))}
        </ul>
      </section>
    </SkeletonPage>
  );
}
