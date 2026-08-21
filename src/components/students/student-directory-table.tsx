import Link from "next/link";
import { formatPaise } from "@/lib/domain/money";
import type { StudentDirectoryRow } from "@/lib/records/student-directory";
import type { StudentSortKey } from "@/lib/shell/student-table-params";
import { SortableHeader } from "@/components/records/sortable-header";
import { PaginationControls } from "@/components/records/pagination-controls";

interface StudentDirectoryTableProps {
  rows: StudentDirectoryRow[];
  sort: StudentSortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

function PaymentStatus({ row }: { row: StudentDirectoryRow }) {
  if (row.feeAccountCount === 0) {
    return <span className="text-2xs text-ink-muted">—</span>;
  }
  if (row.hasOverdue) {
    return (
      <span className="text-2xs text-attention">
        Overdue · {formatPaise(row.totalPendingPaise)}
      </span>
    );
  }
  if (row.totalPendingPaise > 0n) {
    return (
      <span className="text-2xs text-attention">
        Pending · {formatPaise(row.totalPendingPaise)}
      </span>
    );
  }
  return <span className="text-2xs text-positive">Paid</span>;
}

const SERVICE_LABEL: Record<string, string> = {
  transport: "Transport",
  daycare: "Daycare",
};

function RowActions({ row }: { row: StudentDirectoryRow }) {
  if (row.feeAccounts.length === 0) {
    return <span className="text-2xs text-ink-muted">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {row.feeAccounts.map((account) => (
        <div key={account.feeAccountId} className="text-2xs whitespace-nowrap">
          <span className="text-ink-muted">
            {SERVICE_LABEL[account.serviceType] ?? account.serviceType}
            {row.feeAccounts.length > 1
              ? ` (${account.academicYearLabel})`
              : ""}
            {": "}
          </span>
          <Link
            href={`/${account.serviceType}/${account.feeAccountId}/edit`}
            className="text-accent hover:underline"
          >
            Edit
          </Link>
          {" · "}
          <Link
            href={`/${account.serviceType}/${account.feeAccountId}/payment`}
            className="text-accent hover:underline"
          >
            Record payment
          </Link>
        </div>
      ))}
    </div>
  );
}

export function StudentDirectoryTable({
  rows,
  sort,
  dir,
  page,
  pageSize,
  totalPages,
  searchParams,
}: StudentDirectoryTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-ink-muted">
        No students match these filters — adjust the filters above, or add a
        student from the Transport or Daycare screen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="h-9 border-b border-hairline bg-canvas">
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                S.No.
              </th>
              <th className="px-3 text-left">
                <SortableHeader
                  label="Student"
                  sortKey="full_name"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                />
              </th>
              <th className="px-3 text-left">
                <SortableHeader
                  label="Admission no."
                  sortKey="admission_no"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                />
              </th>
              <th className="px-3 text-left">
                <SortableHeader
                  label="Class"
                  sortKey="class_section"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                />
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Branch
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Guardian
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Phone
              </th>
              <th className="px-3 text-left">
                <SortableHeader
                  label="Date added"
                  sortKey="created_at"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                />
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Status
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Payment
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={`h-10 border-b border-hairline last:border-0 ${
                  row.hasOverdue
                    ? "border-l-2 border-l-attention bg-attention-fill/20"
                    : ""
                }`}
              >
                <td className="px-3 text-ink-secondary tabular-nums">
                  {(page - 1) * pageSize + index + 1}
                </td>
                <td className="px-3">
                  <Link
                    href={`/transport/student/${row.id}`}
                    className="text-accent hover:underline"
                  >
                    {row.fullName}
                  </Link>
                </td>
                <td className="px-3 text-ink-secondary">{row.admissionNo}</td>
                <td className="px-3 text-ink-secondary">{row.classSection}</td>
                <td className="px-3 text-ink-secondary">{row.branchName}</td>
                <td className="px-3 text-ink-secondary">{row.guardianName}</td>
                <td className="px-3 text-ink-secondary">{row.phone}</td>
                <td className="px-3 text-ink-secondary tabular-nums">
                  {row.createdAt.slice(0, 10)}
                </td>
                <td className="px-3">
                  {row.status === "inactive" ? (
                    <span className="text-2xs text-attention">Deleted</span>
                  ) : (
                    <span className="text-2xs text-ink-muted">Active</span>
                  )}
                </td>
                <td className="px-3 tabular-nums">
                  <PaymentStatus row={row} />
                </td>
                <td className="px-3">
                  <RowActions row={row} />
                </td>
              </tr>
            ))}
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
