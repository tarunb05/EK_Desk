import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  RecordTableSearchParams,
  SortKey,
} from "@/lib/shell/table-params";
import type { FeeAccountRecordRow, ServiceType } from "@/lib/records/types";

type FeeAccountRecordDbRow =
  Database["public"]["Views"]["fee_account_record"]["Row"];

const SORT_COLUMN: Record<SortKey, string> = {
  full_name: "student_full_name",
  pending_paise: "pending_paise",
  collected_paise: "collected_paise",
  total_receivable_paise: "total_receivable_paise",
  due_date: "due_date",
};

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

export interface RecordScopeParams {
  serviceType: ServiceType;
  academicYearId: string;
  branch: "all" | string;
  table: RecordTableSearchParams;
}

function applyFilters(
  supabase: SupabaseClient<Database>,
  { serviceType, academicYearId, branch, table }: RecordScopeParams,
  { head }: { head: boolean },
) {
  let query = supabase
    .from("fee_account_record")
    .select("*", { count: "exact", head })
    .eq("service_type", serviceType)
    .eq("academic_year_id", academicYearId)
    .eq("student_status", "active");

  if (branch !== "all") {
    query = query.eq("branch_code", branch);
  }
  if (table.classSection) {
    query = query.eq("class_section", table.classSection);
  }
  if (table.q) {
    query = query.ilike("student_full_name", `%${table.q}%`);
  }
  if (table.status === "overdue") {
    query = query.gt("pending_paise", 0).lt("due_date", todayIso());
  } else if (table.status === "pending") {
    query = query.gt("pending_paise", 0);
  } else if (table.status === "paid") {
    query = query.lte("pending_paise", 0);
  }

  return query;
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
// overdue) -- a separate function from getAllFeeAccountRecords rather than
// forcing "collected" into RecordTableSearchParams.status, since that enum
// is the Students-page filter chips (all/overdue/pending/paid) and adding
// a fifth "has any collection" option there isn't something that page
// asked for. Every metric still shares the same active-student, in-scope
// base query.
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
