"use client";

import { useTableTransition } from "@/components/records/table-transition";

// Column widths mirror TableSkeleton's own convention (first widest, then
// a second slightly-wide one, everything else narrow) -- same shimmer
// language as the route-level loading.tsx skeletons, just triggered by a
// same-route sort/page change instead of a fresh navigation.
function shimmerWidth(column: number): string {
  if (column === 0) return "w-16";
  if (column === 1) return "w-24";
  return "w-14";
}

// Swaps a table's real rows for shimmering placeholder rows while a
// sort/page navigation for this table is in flight (see
// TableTransitionProvider) -- real rows are passed as `children` and
// rendered unchanged once the navigation settles, so this never touches
// their own markup or the server-rendered data.
export function PendingTbody({
  columns,
  rowCount,
  children,
}: {
  columns: number;
  rowCount: number;
  children: React.ReactNode;
}) {
  const { isPending } = useTableTransition();

  if (!isPending) {
    return <tbody>{children}</tbody>;
  }

  return (
    <tbody aria-busy="true">
      {Array.from({ length: Math.min(rowCount, 8) || 4 }, (_, row) => (
        <tr key={row} className="h-10 border-b border-hairline last:border-0">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className="px-3">
              <div
                aria-hidden="true"
                className={`animate-shimmer h-3 rounded-md bg-hairline ${shimmerWidth(column)}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
