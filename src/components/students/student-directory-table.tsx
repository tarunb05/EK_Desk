import Link from "next/link";
import { formatPaise } from "@/lib/domain/money";
import type { StudentDirectoryRow } from "@/lib/records/student-directory";
import type { StudentSortKey } from "@/lib/shell/student-table-params";
import type { Role } from "@/lib/auth/routes";
import { SortableHeader } from "@/components/records/sortable-header";
import { PaginationControls } from "@/components/records/pagination-controls";
import { TableTransitionProvider } from "@/components/records/table-transition";
import { PendingTbody } from "@/components/records/pending-tbody";
import { AlertIcon, ClockIcon, StatusIcon } from "@/components/shell/nav-icons";
import { RowActionMenu } from "@/components/students/row-action-menu";

interface StudentDirectoryTableProps {
  rows: StudentDirectoryRow[];
  sort: StudentSortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  role: Role;
}

function PaymentStatus({ row }: { row: StudentDirectoryRow }) {
  if (row.feeAccountCount === 0) {
    return <span className="text-2xs text-ink-muted">—</span>;
  }
  if (row.hasOverdue) {
    return (
      <span className="flex items-center gap-1 text-2xs text-attention">
        <AlertIcon size={13} />
        Overdue · {formatPaise(row.totalPendingPaise)}
      </span>
    );
  }
  if (row.totalPendingPaise > 0n) {
    return (
      <span className="flex items-center gap-1 text-2xs text-attention">
        <ClockIcon size={13} />
        Pending · {formatPaise(row.totalPendingPaise)}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-2xs text-positive">
      <StatusIcon size={13} />
      Paid
    </span>
  );
}

const SERVICE_LABEL: Record<string, string> = {
  transport: "Transport",
  daycare: "Daycare",
};

function RowActions({ row, role }: { row: StudentDirectoryRow; role: Role }) {
  if (row.feeAccounts.length === 0) {
    return (
      <RowActionMenu
        studentId={row.id}
        studentName={row.fullName}
        role={role}
      />
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {row.feeAccounts.map((account) => {
        // Admin and teacher see an identical Students page -- a teacher's
        // edit/payment pages just live under /students, since /transport
        // and /daycare are admin-only routes.
        const [editHref, paymentHref] =
          role === "admin"
            ? [
                `/${account.serviceType}/${account.feeAccountId}/edit`,
                `/${account.serviceType}/${account.feeAccountId}/payment`,
              ]
            : [
                `/students/fee-account/${account.feeAccountId}/edit`,
                `/students/fee-account/${account.feeAccountId}/payment`,
              ];
        return (
          <div
            key={account.feeAccountId}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            {/* Fixed width, not just gap-1.5 after an inline label -- with
                a student that has both a Transport and a Daycare account,
                "Transport" and "Daycare (2026-27)" are different lengths,
                which pushed each row's own Actions button to a different
                x position instead of lining up in a column. */}
            <span className="w-28 shrink-0 truncate text-2xs text-ink-muted">
              {SERVICE_LABEL[account.serviceType] ?? account.serviceType}
              {row.feeAccounts.length > 1
                ? ` (${account.academicYearLabel})`
                : ""}
            </span>
            <RowActionMenu
              editHref={editHref}
              paymentHref={paymentHref}
              studentId={row.id}
              studentName={row.fullName}
              role={role}
              requestPaymentFeeAccountId={
                account.status === "active" ? account.feeAccountId : undefined
              }
            />
            {account.paymentRequestStatus === "open" ? (
              <span className="text-2xs text-ink-muted">Request open</span>
            ) : account.paymentRequestStatus === "reported" ? (
              <span className="text-2xs text-attention">Payment reported</span>
            ) : null}
          </div>
        );
      })}
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
  role,
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
    <TableTransitionProvider>
      <div className="flex flex-col gap-3">
        {/* Below md each row becomes a two-column card (name + payment
            status, then admission no. + class, phone, actions) -- the full
            ten-column table is 945px wide, which hid Payment and Actions
            off-screen on a phone. Same rows and menus either way, just
            restyled, so nothing renders twice. */}
        <div className="overflow-x-auto rounded-md border border-hairline">
          <table className="w-full border-collapse text-sm max-md:block max-md:[&>tbody]:block">
            <thead className="max-md:hidden">
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
                  Payment
                </th>
                <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <PendingTbody columns={9} rowCount={rows.length}>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                  className={`animate-row-in h-10 border-b border-hairline transition-colors last:border-0 max-md:grid max-md:h-auto max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:py-2.5 ${
                    row.hasOverdue
                      ? "border-l-2 border-l-attention bg-attention-fill/20"
                      : "border-l-2 border-l-transparent even:bg-hairline/40 hover:border-l-accent hover:bg-surface-accent"
                  }`}
                >
                  <td className="px-3 text-ink-secondary tabular-nums max-md:hidden">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className="px-3 max-md:order-1 max-md:min-w-0 max-md:truncate max-md:font-medium">
                    <Link
                      href={`/students/student/${row.id}`}
                      // On phones, padding with a matching negative margin
                      // gives the name a ~40px tap target without making
                      // the card taller.
                      className="text-accent hover:underline max-md:-my-3 max-md:inline-block max-md:py-3"
                    >
                      {row.fullName}
                    </Link>
                  </td>
                  <td className="px-3 text-ink-secondary max-md:order-3 max-md:text-2xs">
                    {row.admissionNo}
                  </td>
                  <td className="px-3 text-ink-secondary max-md:order-4 max-md:text-right max-md:text-2xs">
                    {row.classSection}
                  </td>
                  <td className="px-3 text-ink-secondary max-md:hidden">
                    {row.branchName}
                  </td>
                  <td className="px-3 text-ink-secondary max-md:hidden">
                    {row.guardianName}
                  </td>
                  <td className="px-3 text-ink-secondary max-md:order-5 max-md:col-span-2 max-md:text-2xs">
                    {row.phone}
                  </td>
                  <td className="px-3 text-ink-secondary tabular-nums max-md:hidden">
                    {row.createdAt.slice(0, 10)}
                  </td>
                  <td className="px-3 tabular-nums max-md:order-2 max-md:justify-self-end">
                    <PaymentStatus row={row} />
                  </td>
                  <td className="px-3 max-md:order-6 max-md:col-span-2 max-md:pt-1">
                    <RowActions row={row} role={role} />
                  </td>
                </tr>
              ))}
            </PendingTbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          searchParams={searchParams}
        />
      </div>
    </TableTransitionProvider>
  );
}
