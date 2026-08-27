import { Skeleton, SkeletonPage } from "@/components/shell/skeleton";

// This page is just a BackLink, a title, and two link buttons (choose
// transport or daycare) -- not worth its own dedicated skeleton
// component for a shape this small.
export default function Loading() {
  return (
    <SkeletonPage>
      <div className="max-w-xl">
        <Skeleton className="mb-4 h-3.5 w-24" />
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </SkeletonPage>
  );
}
