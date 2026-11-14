import { formatMethod, formatPaise } from "@/lib/domain/money";
import { formatDisplayDate } from "@/lib/domain/datetime";
import type { ExpenseDirectoryRow } from "@/lib/records/expense-directory";
import type { ExpenseSortKey } from "@/lib/shell/expense-table-params";
import type { Role } from "@/lib/auth/routes";
import { SortableHeader } from "@/components/records/sortable-header";
import { PaginationControls } from "@/components/records/pagination-controls";
import { TableTransitionProvider } from "@/components/records/table-transition";
import { PendingTbody } from "@/components/records/pending-tbody";
import { ExpenseRowActions } from "@/components/expenses/expense-row-actions";
import { EmptyNote } from "@/components/shell/empty-note";

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
      <EmptyNote>
        No expenses match these filters. Adjust the filters above, or record one
        from the button above the list.
      </EmptyNote>
    );
  }

  const columns = role === "admin" ? 9 : 8;

  return (
    <TableTransitionProvider>
      <div className="flex flex-col gap-3">
        <div className="scroll-reveal overflow-x-auto rounded-lg border border-hairline bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="h-9 border-b border-hairline bg-sand/50">
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
            <PendingTbody columns={columns} rowCount={rows.length}>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                  className="animate-row-in h-10 border-b border-hairline border-l-2 border-l-transparent even:bg-canvas/50 transition-colors last:border-0 hover:border-l-accent hover:bg-surface-accent"
                >
                  <td className="px-3 text-ink-secondary tabular-nums">
                    {formatDisplayDate(row.spentOn)}
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
                    {formatMethod(row.method)}
                  </td>
                  <td className="px-3 text-ink-secondary">
                    {row.reference || "-"}
                  </td>
                  <td className="px-3 text-ink-secondary">{row.note || "-"}</td>
                  <td className="px-3 text-ink-secondary">
                    <span>{row.createdByName}</span>
                    {row.isEdited ? (
                      <span className="ml-1.5 rounded-full bg-surface-accent px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
                        Edited
                        {row.updatedByName ? ` by ${row.updatedByName}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3">
                    <ExpenseRowActions expenseId={row.id} />
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
