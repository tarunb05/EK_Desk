import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-role";
import { getAllExpenses } from "@/lib/records/expense-directory";
import { getBranches } from "@/lib/supabase/queries";
import { paiseToRupees } from "@/lib/domain/money";

// A Route Handler, not a Server Action -- see fee-accounts/route.ts's
// comment for why a Content-Disposition download needs one.

const querySchema = z.object({
  year: z.string().min(1),
  branch: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const authed = await requireAuth();

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export parameters." }, {
      status: 400,
    });
  }
  const { year, branch: requestedBranch } = parsed.data;

  const supabase = await createClient();

  // A teacher's export is clamped to their own branch regardless of what
  // the URL claims, exactly like expenses/page.tsx's own scope resolution
  // -- the query string here is just mirroring the page's current
  // filters, never a trusted access boundary on its own.
  let branch = requestedBranch;
  if (authed.role === "teacher") {
    const branches = await getBranches(supabase);
    branch = branches.find((b) => b.id === authed.branchId)?.code ?? "all";
  }

  const rows = await getAllExpenses(supabase, { branch, academicYearId: year });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Expenses");

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "category", width: 20 },
    { header: "Branch", key: "branch", width: 14 },
    { header: "Amount (₹)", key: "amount", width: 14 },
    { header: "Method", key: "method", width: 14 },
    { header: "Reference", key: "reference", width: 16 },
    { header: "Note", key: "note", width: 28 },
    { header: "Entered by", key: "enteredBy", width: 18 },
    { header: "Edited", key: "edited", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      date: row.spentOn,
      category: row.categoryName,
      branch: row.branchName,
      amount: paiseToRupees(row.amountPaise),
      method: row.method,
      reference: row.reference,
      note: row.note,
      enteredBy: row.createdByName,
      edited: row.isEdited ? "Yes" : "No",
    });
  }
  sheet.getColumn("amount").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `expenses-${year}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
