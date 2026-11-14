import Link from "next/link";
import { formatPaise } from "@/lib/domain/money";
import { formatDisplayDate } from "@/lib/domain/datetime";
import type { StudentDirectoryRow } from "@/lib/records/student-directory";
import type { StudentSortKey } from "@/lib/shell/student-table-params";
import type { Role } from "@/lib/auth/routes";
import { SortableHeader } from "@/components/records/sortable-header";
import { PaginationControls } from "@/components/records/pagination-controls";
import { TableTransitionProvider } from "@/components/records/table-transition";
import { PendingTbody } from "@/components/records/pending-tbody";
import { AlertIcon, ClockIcon, StatusIcon } from "@/components/shell/nav-icons";
import {
  RowActionMenu,
  type EnrollmentOption,
} from "@/components/students/row-action-menu";
import { enrollmentLabel } from "@/lib/domain/enrollment-label";
import { EmptyNote } from "@/components/shell/empty-note";

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

// Each state is a differently built chip (filled, outlined, tinted) with its
// own icon and word, so the three read apart without relying on colour.
function PaymentStatus({ row }: { row: StudentDirectoryRow }) {
  if (row.feeAccountCount === 0) {
    return <span className="text-2xs text-ink-muted">-</span>;
  }
  if (row.hasOverdue) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs bg-attention-fill font-medium text-attention">
        <AlertIcon size={13} />
        Overdue · {formatPaise(row.totalPendingPaise)}
      </span>
    );
  }
  if (row.totalPendingPaise > 0n) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs border border-attention/40 text-attention">
        <ClockIcon size={13} />
        Pending · {formatPaise(row.totalPendingPaise)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs bg-surface-accent text-positive">
      <StatusIcon size={13} />
      Paid
    </span>
  );
}

// One Actions menu per student. The student's enrollments go inside it,
// each labelled (daycare by its dates, transport by year) so several can be
// told apart. Admin and teacher see the same menu -- a teacher's edit and
// payment pages just live under /students, since /transport and /daycare
// are admin-only routes.
function RowActions({ row, role }: { row: StudentDirectoryRow; role: Role }) {
  const enrollments: EnrollmentOption[] = row.feeAccounts.map((account) => ({
    feeAccountId: account.feeAccountId,
    label: enrollmentLabel(account),
    serviceType: account.serviceType,
    active: account.status === "active",
    editHref:
      role === "admin"
        ? `/${account.serviceType}/${account.feeAccountId}/edit`
        : `/students/fee-account/${account.feeAccountId}/edit`,
    paymentHref:
      role === "admin"
        ? `/${account.serviceType}/${account.feeAccountId}/payment`
        : `/students/fee-account/${account.feeAccountId}/payment`,
  }));
  // Phase 15.5's markers, one line per enrollment that has something open,
  // named so it's clear which enrollment they mean.
  const markers = row.feeAccounts.filter(
    (account) => account.paymentRequestStatus !== "none",
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <RowActionMenu
        studentId={row.id}
        studentName={row.fullName}
        role={role}
        enrollments={enrollments}
      />
      {markers.map((account) => (
        <span
          key={account.feeAccountId}
          className={`text-2xs ${
            account.paymentRequestStatus === "reported"
              ? "text-attention"
              : "text-ink-muted"
          }`}
        >
          {account.paymentRequestStatus === "reported"
            ? "Payment reported"
            : "Request open"}
          {row.feeAccounts.length > 1 ? ` · ${enrollmentLabel(account)}` : ""}
        </span>
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
  role,
}: StudentDirectoryTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyNote>
        No students match these filters. Adjust the filters above, or add a
        student from the Transport or Daycare screen.
      </EmptyNote>
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
        <div className="scroll-reveal overflow-x-auto rounded-lg border border-hairline bg-surface">
          <table className="w-full border-collapse text-sm max-md:block max-md:[&>tbody]:block">
            <thead className="max-md:hidden">
              <tr className="h-9 border-b border-hairline bg-sand/50">
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
                      : "border-l-2 border-l-transparent even:bg-canvas/50 hover:border-l-accent hover:bg-surface-accent"
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
                    {formatDisplayDate(row.createdAt.slice(0, 10))}
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
