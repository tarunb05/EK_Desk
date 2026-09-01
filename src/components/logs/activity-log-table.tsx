import type { ActivityLogRow } from "@/lib/records/activity-log";
import { formatLogDate, formatLogTimestamp } from "@/lib/domain/datetime";
import { formatPaise } from "@/lib/domain/money";

const ACTION_LABEL: Record<ActivityLogRow["action"], string> = {
  create: "Created",
  update: "Edited",
  delete: "Deleted",
};

const ENTITY_LABEL: Record<string, string> = {
  student: "Student",
  fee_account: "Fee account",
  payment: "Payment",
  expense: "Expense",
  expense_category: "Category",
  student_submission: "Submission",
  profile: "User",
};

// Shared between the header row and every <summary> row so their columns
// line up -- When / Who / What / Which / Amount, matching "the row" in the
// phase 12 plan exactly.
const ROW_GRID = "grid grid-cols-[150px_160px_90px_1fr_110px] items-center gap-4";

function EmptyState({
  filtersActive,
  seededAt,
}: {
  filtersActive: boolean;
  seededAt: string | null;
}) {
  if (filtersActive) {
    return (
      <p className="py-8 text-sm text-ink-muted">
        No activity matches these filters.{" "}
        <a href="?" className="text-accent hover:underline">
          Clear them
        </a>
        .
      </p>
    );
  }
  return (
    <p className="py-8 text-sm text-ink-muted">
      No activity recorded yet.
      {seededAt ? ` This log starts from ${formatLogDate(seededAt)}.` : ""}
    </p>
  );
}

export function ActivityLogTable({
  rows,
  seededAt,
  filtersActive,
  branchNameById,
  yearLabelById,
}: {
  rows: ActivityLogRow[];
  seededAt: string | null;
  filtersActive: boolean;
  branchNameById: Record<string, string>;
  yearLabelById: Record<string, string>;
}) {
  if (rows.length === 0) {
    return <EmptyState filtersActive={filtersActive} seededAt={seededAt} />;
  }

  return (
    <div
      role="table"
      aria-label="Activity log"
      className="overflow-hidden rounded-md border border-hairline"
    >
      <div
        role="row"
        className={`${ROW_GRID} h-9 border-b border-hairline bg-canvas px-3`}
      >
        <span role="columnheader" className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          When
        </span>
        <span role="columnheader" className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Who
        </span>
        <span role="columnheader" className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          What
        </span>
        <span role="columnheader" className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Which
        </span>
        <span role="columnheader" className="text-right text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Amount
        </span>
      </div>

      <div role="rowgroup" className="flex flex-col">
        {rows.map((row) => {
          const isDelete = row.action === "delete";
          const amountPaise = row.afterAmountPaise ?? row.beforeAmountPaise;
          const hasBeforeAfter =
            row.beforeAmountPaise !== null &&
            row.afterAmountPaise !== null &&
            row.beforeAmountPaise !== row.afterAmountPaise;

          return (
            <details
              key={row.id}
              role="row"
              className={`activity-log-row group border-b border-hairline last:border-0 ${
                isDelete ? "border-l-2 border-l-attention bg-attention-fill/20" : "border-l-2 border-l-transparent even:bg-hairline/40"
              }`}
            >
              <summary
                className={`${ROW_GRID} h-10 cursor-pointer list-none px-3 transition-colors duration-150 [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                  isDelete ? "" : "hover:border-l-accent hover:bg-surface-accent"
                }`}
              >
                <span role="cell" className="whitespace-nowrap tabular-nums text-ink-secondary">
                  {formatLogTimestamp(row.occurredAt)}
                </span>
                <span role="cell" className="truncate">
                  <span className="text-ink">{row.actorLabel}</span>
                  {row.actorRole ? (
                    <span className="ml-1.5 text-2xs text-ink-muted">{row.actorRole}</span>
                  ) : null}
                </span>
                <span
                  role="cell"
                  className={isDelete ? "font-medium text-attention" : "text-ink"}
                >
                  {ACTION_LABEL[row.action]}
                </span>
                <span role="cell" className="truncate text-ink-secondary">
                  <span className="text-ink-muted">
                    {ENTITY_LABEL[row.entity] ?? row.entity}
                  </span>
                  {" — "}
                  <span className="text-ink">{row.entityLabel}</span>
                </span>
                <span role="cell" className="text-right tabular-nums text-ink">
                  {amountPaise !== null ? formatPaise(amountPaise) : ""}
                </span>
              </summary>

              <div className="flex flex-col gap-1.5 px-3 pb-3 pl-[24px] text-sm text-ink-secondary">
                <p className="text-ink">{row.summary}</p>
                {row.changedFields && row.changedFields.length > 0 ? (
                  <p>
                    Changed:{" "}
                    {row.changedFields.map((field) => field.replace(/_/g, " ")).join(", ")}
                  </p>
                ) : null}
                {hasBeforeAfter ? (
                  <p className="tabular-nums">
                    {formatPaise(row.beforeAmountPaise!)} → {formatPaise(row.afterAmountPaise!)}
                  </p>
                ) : null}
                {row.branchId && branchNameById[row.branchId] ? (
                  <p>{branchNameById[row.branchId]}</p>
                ) : null}
                {row.academicYearId && yearLabelById[row.academicYearId] ? (
                  <p>{yearLabelById[row.academicYearId]}</p>
                ) : null}
                {row.entityId ? (
                  <p className="text-2xs text-ink-muted">{row.entityId}</p>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
