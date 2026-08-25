import Link from "next/link";
import { formatPaise } from "@/lib/domain/money";
import type { ExpenseDirectoryRow } from "@/lib/records/expense-directory";
import type { ExpenseSortKey } from "@/lib/shell/expense-table-params";
import type { Role } from "@/lib/auth/routes";
import { SortableHeader } from "@/components/records/sortable-header";
import { PaginationControls } from "@/components/records/pagination-controls";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  cheque: "Cheque",
  bank_transfer: "Bank transfer",
};

interface ExpenseTableProps {
  rows: ExpenseDirectoryRow[];
  sort: ExpenseSortKey;
  dir: "asc" | "desc";
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  role: Role;
}

export function ExpenseTable({
  rows,
  sort,
  dir,
  page,
  totalPages,
  searchParams,
  role,
}: ExpenseTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-ink-muted">
        No expenses match these filters — adjust the filters above, or record
        one from the button above the list.
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
                  label="Date"
                  sortKey="spent_on"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                />
              </th>
              <th className="px-3 text-left">
                <SortableHeader
                  label="Category"
                  sortKey="category_name"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                />
              </th>
              {role === "admin" ? (
                <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                  Branch
                </th>
              ) : null}
              <th className="px-3 text-right">
                <SortableHeader
                  label="Amount"
                  sortKey="amount_paise"
                  currentSort={sort}
                  currentDir={dir}
                  searchParams={searchParams}
                  align="right"
                />
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Method
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Reference
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Note
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Entered by
              </th>
              <th className="px-3 text-left text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="h-10 border-b border-hairline transition-colors last:border-0 hover:bg-surface-accent"
              >
                <td className="px-3 text-ink-secondary tabular-nums">
                  {row.spentOn}
                </td>
                <td className="px-3 text-ink">{row.categoryName}</td>
                {role === "admin" ? (
                  <td className="px-3 text-ink-secondary">
                    {row.branchName}
                  </td>
                ) : null}
                <td className="px-3 text-right tabular-nums text-ink">
                  {formatPaise(row.amountPaise)}
                </td>
                <td className="px-3 text-ink-secondary">
                  {METHOD_LABEL[row.method] ?? row.method}
                </td>
                <td className="px-3 text-ink-secondary">
                  {row.reference || "—"}
                </td>
                <td className="px-3 text-ink-secondary">{row.note || "—"}</td>
                <td className="px-3 text-ink-secondary">
                  <span>{row.createdByName}</span>
                  {row.isEdited ? (
                    <span className="ml-1.5 rounded-md bg-surface-accent px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
                      Edited
                      {row.updatedByName ? ` by ${row.updatedByName}` : ""}
                    </span>
                  ) : null}
                </td>
                <td className="px-3">
                  <Link
                    href={`/expenses/${row.id}/edit`}
                    className="text-2xs text-accent hover:underline"
                  >
                    Edit
                  </Link>
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
