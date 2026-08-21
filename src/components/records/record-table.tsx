import Link from "next/link";
import { formatPaise } from "@/lib/domain/money";
import { isOverdue } from "@/lib/domain/overdue";
import type { FeeAccountRecordRow, ServiceType } from "@/lib/records/types";
import type { SortKey } from "@/lib/shell/table-params";
import { PaginationControls } from "./pagination-controls";
import { SortableHeader } from "./sortable-header";

interface RecordTableProps {
  rows: FeeAccountRecordRow[];
  serviceType: ServiceType;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

export function RecordTable({
  rows,
  serviceType,
  sort,
  dir,
  page,
  totalPages,
  searchParams,
}: RecordTableProps) {
  const groupLabel = serviceType === "transport" ? "Route" : "Slot";
  const today = new Date();

  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-ink-muted">
        No {serviceType} fee accounts match these filters — add a student or
        adjust the filters above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="h-9 border-b border-hairline bg-canvas">
              <th className="px-3 text-left">
                <SortableHeader
                  label="Student"
                  sortKey="full_name"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                />
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Class
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                {groupLabel}
              </th>
              <th className="px-3 text-right">
                <SortableHeader
                  label="Receivable"
                  sortKey="total_receivable_paise"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                  align="right"
                />
              </th>
              <th className="px-3 text-right">
                <SortableHeader
                  label="Collected"
                  sortKey="collected_paise"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                  align="right"
                />
              </th>
              <th className="px-3 text-right">
                <SortableHeader
                  label="Pending"
                  sortKey="pending_paise"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                  align="right"
                />
              </th>
              <th className="px-3 text-right">
                <SortableHeader
                  label="Due"
                  sortKey="due_date"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                  align="right"
                />
              </th>
              <th className="px-3 text-right text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdue = isOverdue(
                row.pendingPaise,
                new Date(row.dueDate),
                today,
              );
              return (
                <tr
                  key={row.feeAccountId}
                  className={`h-10 border-b border-hairline last:border-0 ${
                    overdue
                      ? "border-l-2 border-l-attention bg-attention-fill/20"
                      : ""
                  }`}
                >
                  <td className="px-3">
                    <Link
                      href={`/${serviceType}/student/${row.studentId}`}
                      className="text-accent hover:underline"
                    >
                      {row.studentFullName}
                    </Link>
                  </td>
                  <td className="px-3 text-ink-secondary">
                    {row.classSection}
                  </td>
                  <td className="px-3 text-ink-secondary">
                    {row.routeName ?? row.slot ?? "—"}
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    {formatPaise(row.totalReceivablePaise)}
                  </td>
                  <td className="px-3 text-right tabular-nums text-positive">
                    {formatPaise(row.collectedPaise)}
                  </td>
                  <td className="px-3 text-right tabular-nums text-attention">
                    {formatPaise(row.pendingPaise)}
                  </td>
                  <td className="px-3 text-right tabular-nums text-ink-secondary">
                    {row.dueDate}
                    {overdue ? (
                      <span className="ml-1 text-2xs text-attention">
                        Overdue
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 text-right whitespace-nowrap">
                    <Link
                      href={`/${serviceType}/${row.feeAccountId}/edit`}
                      className="text-accent hover:underline"
                    >
                      Edit
                    </Link>
                    {" · "}
                    <Link
                      href={`/${serviceType}/${row.feeAccountId}/payment`}
                      className="text-accent hover:underline"
                    >
                      Record payment
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        searchParams={searchParams}
      />
    </div>
  );
}
