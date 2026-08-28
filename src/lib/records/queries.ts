import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { FeeAccountRecordRow, ServiceType } from "@/lib/records/types";

type FeeAccountRecordDbRow =
  Database["public"]["Views"]["fee_account_record"]["Row"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapFeeAccountRecordRow(
  row: FeeAccountRecordDbRow,
  fallbackServiceType: ServiceType,
): FeeAccountRecordRow {
  return {
    feeAccountId: row.fee_account_id ?? "",
    studentId: row.student_id ?? "",
    studentFullName: row.student_full_name ?? "",
    studentAdmissionNo: row.student_admission_no ?? "",
    guardianName: row.student_guardian_name ?? "",
    phone: row.student_phone ?? "",
    notes: row.student_notes,
    classSection: row.class_section ?? "",
    branchCode: row.branch_code ?? "",
    branchName: row.branch_name ?? "",
    serviceType: (row.service_type ?? fallbackServiceType) as ServiceType,
    totalReceivablePaise: BigInt(row.total_receivable_paise ?? 0),
    collectedPaise: BigInt(row.collected_paise ?? 0),
    pendingPaise: BigInt(row.pending_paise ?? 0),
    dueDate: row.due_date ?? "",
    startsOn: row.starts_on ?? "",
    endsOn: row.ends_on ?? "",
    lastPaidOn: row.last_paid_on,
    status: (row.status ?? "active") as "active" | "discontinued",
    routeName: row.route_name,
    pickupPoint: row.pickup_point,
    slot: row.slot,
  };
}

export type FeeAccountExportMetric =
  | "receivable"
  | "collected"
  | "pending"
  | "overdue";

export interface FeeAccountExportParams {
  serviceType: ServiceType;
  academicYearId: string;
  branch: "all" | string;
  metric: FeeAccountExportMetric;
}

// Backs the stat-card Excel exports (Total receivable/collected/pending/
// overdue). Its own metric enum rather than the Students-page status filter
// chips (all/overdue/pending/paid) -- "collected" isn't one of those, and
// adding a fifth option there isn't something that page asked for. Every
// metric still shares the same active-student, in-scope base query.
export async function getFeeAccountRecordsForExport(
  supabase: SupabaseClient<Database>,
  { serviceType, academicYearId, branch, metric }: FeeAccountExportParams,
): Promise<FeeAccountRecordRow[]> {
  let query = supabase
    .from("fee_account_record")
    .select("*")
    .eq("service_type", serviceType)
    .eq("academic_year_id", academicYearId)
    .eq("student_status", "active");

  if (branch !== "all") {
    query = query.eq("branch_code", branch);
  }

  if (metric === "collected") {
    query = query.gt("collected_paise", 0);
  } else if (metric === "pending") {
    query = query.gt("pending_paise", 0);
  } else if (metric === "overdue") {
    query = query.gt("pending_paise", 0).lt("due_date", todayIso());
  }
  // "receivable" gets no extra condition -- every fee account in scope has
  // a receivable amount by definition.

  const { data, error } = await query.order("student_full_name", {
    ascending: true,
  });

  if (error) {
    throw new Error("Could not load records for export.");
  }

  return data.map((row) => mapFeeAccountRecordRow(row, serviceType));
}

export async function getFeeAccountRecordById(
  supabase: SupabaseClient<Database>,
  feeAccountId: string,
): Promise<FeeAccountRecordRow | null> {
  const { data, error } = await supabase
    .from("fee_account_record")
    .select("*")
    .eq("fee_account_id", feeAccountId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapFeeAccountRecordRow(data, "transport");
}
