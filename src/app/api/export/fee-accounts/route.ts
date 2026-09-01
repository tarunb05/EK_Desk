import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  getFeeAccountRecordsForExport,
  type FeeAccountExportMetric,
} from "@/lib/records/queries";
import { paiseToRupees } from "@/lib/domain/money";
import { sanitizeForSpreadsheet } from "@/lib/records/spreadsheet-sanitizer";
import type { ServiceType } from "@/lib/records/types";

// A Route Handler, not a Server Action -- per CLAUDE.md, a binary file
// download that needs a Content-Disposition header is one of the two
// genuine exceptions to "Server Actions for everything," since a Server
// Action can't stream one. This is the first Route Handler in the app.

const querySchema = z.object({
  service: z.enum(["transport", "daycare"]),
  metric: z.enum(["receivable", "collected", "pending", "overdue"]),
  year: z.string().min(1),
  branch: z.string().min(1),
});

const METRIC_LABEL: Record<FeeAccountExportMetric, string> = {
  receivable: "Receivable",
  collected: "Collected",
  pending: "Pending",
  overdue: "Overdue",
};

export async function GET(request: NextRequest) {
  // Same defense-in-depth every page/Server Action in this app already
  // does -- middleware's ROUTE_ACCESS check already keeps a teacher out,
  // but nothing here trusts that alone.
  await requireRole("admin");

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export parameters." }, {
      status: 400,
    });
  }
  const { service, metric, year, branch } = parsed.data;

  const supabase = await createClient();
  const rows = await getFeeAccountRecordsForExport(supabase, {
    serviceType: service as ServiceType,
    academicYearId: year,
    branch,
    metric,
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(METRIC_LABEL[metric]);

  sheet.columns = [
    { header: "Student", key: "student", width: 24 },
    { header: "Admission No.", key: "admissionNo", width: 16 },
    { header: "Class", key: "classSection", width: 14 },
    { header: "Branch", key: "branch", width: 14 },
    { header: "Guardian", key: "guardian", width: 22 },
    { header: "Phone", key: "phone", width: 14 },
    { header: "Receivable (₹)", key: "receivable", width: 16 },
    { header: "Collected (₹)", key: "collected", width: 16 },
    { header: "Pending (₹)", key: "pending", width: 16 },
    { header: "Due date", key: "dueDate", width: 14 },
    { header: "Overdue", key: "overdue", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  const todayIso = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    sheet.addRow({
      student: sanitizeForSpreadsheet(row.studentFullName),
      admissionNo: sanitizeForSpreadsheet(row.studentAdmissionNo),
      classSection: sanitizeForSpreadsheet(row.classSection),
      branch: sanitizeForSpreadsheet(row.branchName),
      guardian: sanitizeForSpreadsheet(row.guardianName),
      phone: sanitizeForSpreadsheet(row.phone),
      receivable: paiseToRupees(row.totalReceivablePaise),
      collected: paiseToRupees(row.collectedPaise),
      pending: paiseToRupees(row.pendingPaise),
      dueDate: row.dueDate,
      overdue: row.pendingPaise > 0n && row.dueDate < todayIso ? "Yes" : "No",
    });
  }
  for (const key of ["receivable", "collected", "pending"]) {
    sheet.getColumn(key).numFmt = "#,##0.00";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${service}-${metric}-${year}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
