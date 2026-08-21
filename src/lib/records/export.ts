"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getAllFeeAccountRecords,
  type RecordScopeParams,
} from "@/lib/records/queries";
import { paiseToRupees } from "@/lib/domain/money";

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

export async function exportRecordsCsv(
  params: RecordScopeParams,
): Promise<string> {
  const supabase = await createClient();
  const rows = await getAllFeeAccountRecords(supabase, params);

  const groupLabel = params.serviceType === "transport" ? "Route" : "Slot";
  const header = [
    "Student",
    "Admission No",
    "Class",
    "Branch",
    groupLabel,
    "Receivable (INR)",
    "Collected (INR)",
    "Pending (INR)",
    "Due Date",
    "Status",
  ];

  const lines = [toCsvRow(header)];
  for (const row of rows) {
    lines.push(
      toCsvRow([
        row.studentFullName,
        row.studentAdmissionNo,
        row.classSection,
        row.branchName,
        row.routeName ?? row.slot ?? "",
        String(paiseToRupees(row.totalReceivablePaise)),
        String(paiseToRupees(row.collectedPaise)),
        String(paiseToRupees(row.pendingPaise)),
        row.dueDate,
        row.status,
      ]),
    );
  }

  return lines.join("\r\n");
}
