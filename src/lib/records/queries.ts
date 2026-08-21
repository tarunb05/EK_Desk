import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  RecordTableSearchParams,
  SortKey,
} from "@/lib/shell/table-params";
import { resolvePagination, type Pagination } from "@/lib/shell/pagination";
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

export interface GetFeeAccountRecordsParams extends RecordScopeParams {
  page: number;
  pageSize: number;
}

export interface FeeAccountRecordsResult {
  rows: FeeAccountRecordRow[];
  pagination: Pagination;
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

export async function getFeeAccountRecords(
  supabase: SupabaseClient<Database>,
  params: GetFeeAccountRecordsParams,
): Promise<FeeAccountRecordsResult> {
  const { serviceType, table, page, pageSize } = params;

  const { count: totalCount, error: countError } = await applyFilters(
    supabase,
    params,
    { head: true },
  );

  if (countError) {
    throw new Error("Could not load records.");
  }

  const pagination = resolvePagination(page, pageSize, totalCount ?? 0);

  const { data, error } = await applyFilters(supabase, params, { head: false })
    .order(SORT_COLUMN[table.sort], { ascending: table.dir === "asc" })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw new Error("Could not load records.");
  }

  return {
    rows: data.map((row) => mapFeeAccountRecordRow(row, serviceType)),
    pagination,
  };
}

// Same filters as getFeeAccountRecords, but every matching row — used for
// CSV export, where "any filtered view" means the whole result, not a page.
export async function getAllFeeAccountRecords(
  supabase: SupabaseClient<Database>,
  params: RecordScopeParams,
): Promise<FeeAccountRecordRow[]> {
  const { data, error } = await applyFilters(supabase, params, {
    head: false,
  }).order(SORT_COLUMN[params.table.sort], {
    ascending: params.table.dir === "asc",
  });

  if (error) {
    throw new Error("Could not load records.");
  }

  return data.map((row) => mapFeeAccountRecordRow(row, params.serviceType));
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

export async function getDistinctClassSections(
  supabase: SupabaseClient<Database>,
  {
    serviceType,
    academicYearId,
  }: { serviceType: ServiceType; academicYearId: string },
): Promise<string[]> {
  const { data, error } = await supabase
    .from("fee_account_record")
    .select("class_section")
    .eq("service_type", serviceType)
    .eq("academic_year_id", academicYearId)
    .eq("student_status", "active");

  if (error) {
    throw new Error("Could not load class sections.");
  }

  const unique = new Set(
    data
      .map((row) => row.class_section)
      .filter((value): value is string => !!value),
  );
  return [...unique].sort();
}
