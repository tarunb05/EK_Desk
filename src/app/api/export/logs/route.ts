import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  getAllActivityLogRows,
  type ActivityLogFilters,
} from "@/lib/records/activity-log";
import { getBranches } from "@/lib/supabase/queries";
import { activityLogSearchParamsSchema } from "@/lib/shell/activity-log-search-params";
import { sanitizeForSpreadsheet } from "@/lib/records/spreadsheet-sanitizer";
import { formatLogTimestamp } from "@/lib/domain/datetime";
import { paiseToRupees } from "@/lib/domain/money";

// A Route Handler, not a Server Action -- see fee-accounts/route.ts's
// comment for why a Content-Disposition download needs one. A sibling to
// that file and expenses/route.ts, not an extension of either: there is no
// shared `/api/export/[metric]` dynamic route in this app to extend (both
// of those are their own static route files), so a third export follows
// the same pattern as a new file, not a new branch in an existing one.

const ACTION_LABEL: Record<string, string> = {
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

export async function GET(request: NextRequest) {
  await requireRole("admin");

  const params = activityLogSearchParamsSchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  const supabase = await createClient();
  const branches = await getBranches(supabase);
  const selectedBranch = branches.find((b) => b.code === params.branch);

  const filters: ActivityLogFilters = {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    branchId: selectedBranch?.id,
    actorId: params.actor && params.actor !== "all" ? params.actor : undefined,
    action: params.action === "all" ? undefined : params.action,
    entity: params.entity === "all" ? undefined : params.entity,
    q: params.q,
  };

  const rows = await getAllActivityLogRows(supabase, filters);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Activity log");

  sheet.columns = [
    { header: "When", key: "when", width: 20 },
    { header: "Who", key: "who", width: 20 },
    { header: "What", key: "what", width: 12 },
    { header: "Type", key: "type", width: 14 },
    { header: "Which", key: "which", width: 24 },
    { header: "Summary", key: "summary", width: 40 },
    { header: "Amount (₹)", key: "amount", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const amountPaise = row.afterAmountPaise ?? row.beforeAmountPaise;
    sheet.addRow({
      // A real Excel date/time value, not a formatted string -- so it
      // sorts and filters as a date in the spreadsheet the way it does on
      // screen, per "real Excel dates."
      when: new Date(row.occurredAt),
      who: sanitizeForSpreadsheet(row.actorLabel),
      what: ACTION_LABEL[row.action] ?? row.action,
      type: ENTITY_LABEL[row.entity] ?? row.entity,
      which: sanitizeForSpreadsheet(row.entityLabel),
      summary: sanitizeForSpreadsheet(row.summary),
      amount: amountPaise !== null ? paiseToRupees(amountPaise) : null,
    });
  }
  sheet.getColumn("when").numFmt = "dd-mmm-yyyy hh:mm";
  sheet.getColumn("amount").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();

  // Scope in the filename (branch + a from/to hint when the list is
  // narrowed), never a name or any other PII -- matching the fee-accounts
  // and expenses exports' own filenames, which carry service/metric/year
  // and nothing about a person.
  const dateScope =
    params.dateFrom && params.dateTo
      ? params.dateFrom === params.dateTo
        ? params.dateFrom
        : `${params.dateFrom}_to_${params.dateTo}`
      : params.dateFrom
        ? `from-${params.dateFrom}`
        : params.dateTo
          ? `to-${params.dateTo}`
          : "all-dates";
  const scopeParts = [
    "activity-log",
    selectedBranch?.code ?? "all-branches",
    dateScope,
  ];
  const filename = `${scopeParts.join("-")}.xlsx`;
  const generatedAt = formatLogTimestamp(new Date().toISOString());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Neither of this app's other two exports sets these -- added here
      // deliberately for a file that, unlike those two, carries free text
      // (summary, entity_label) straight from user-entered names: no-store
      // keeps a browser or intermediate cache from persisting a copy of
      // this admin-only data, nosniff stops a misconfigured proxy from
      // reinterpreting the response as something else based on sniffed
      // content.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Export-Generated-At": generatedAt,
    },
  });
}
