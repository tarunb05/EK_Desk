import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ServiceType } from "@/lib/records/types";

export interface DashboardScope {
  serviceType: ServiceType;
  academicYearId: string;
  branch: "all" | string;
}

export interface DashboardSummary {
  studentCount: number;
  totalReceivablePaise: bigint;
  totalCollectedPaise: bigint;
  totalPendingPaise: bigint;
  totalOverduePaise: bigint;
}

export interface MonthCollection {
  month: string;
  collectedPaise: bigint;
}

function rpcArgs(scope: DashboardScope) {
  return {
    p_service_type: scope.serviceType,
    p_academic_year_id: scope.academicYearId,
    p_branch_code: scope.branch === "all" ? undefined : scope.branch,
  };
}

export async function getDashboardSummary(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc(
    "dashboard_summary",
    rpcArgs(scope),
  );
  if (error || !data || data.length === 0) {
    throw new Error("Could not load the dashboard summary.");
  }
  const row = data[0]!;
  return {
    studentCount: Number(row.student_count),
    totalReceivablePaise: BigInt(row.total_receivable_paise),
    totalCollectedPaise: BigInt(row.total_collected_paise),
    totalPendingPaise: BigInt(row.total_pending_paise),
    totalOverduePaise: BigInt(row.total_overdue_paise),
  };
}

export async function getCollectionByMonth(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<MonthCollection[]> {
  const { data, error } = await supabase.rpc(
    "dashboard_collection_by_month",
    rpcArgs(scope),
  );
  if (error) {
    throw new Error("Could not load collection by month.");
  }
  return data.map((row) => ({
    month: row.month ?? "",
    collectedPaise: BigInt(row.collected_paise),
  }));
}

export type AgeingBucketKey = "not_yet_due" | "1-30" | "31-60" | "60+";

export interface AgeingBucket {
  bucket: AgeingBucketKey;
  accountCount: number;
  pendingPaise: bigint;
}

const AGEING_ORDER: AgeingBucketKey[] = ["not_yet_due", "1-30", "31-60", "60+"];

// Always returns all four buckets in due-date order -- the SQL groups, so a
// bucket with no accounts is simply absent from its result, and a chart
// that drops an empty bucket reads as a different chart every time the
// data changes.
export async function getAgeingBuckets(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<AgeingBucket[]> {
  const { data, error } = await supabase.rpc(
    "dashboard_ageing_buckets",
    rpcArgs(scope),
  );
  if (error) {
    throw new Error("Could not load the overdue ageing figures.");
  }
  return AGEING_ORDER.map((bucket) => {
    const row = data.find((r) => r.bucket === bucket);
    return {
      bucket,
      accountCount: Number(row?.account_count ?? 0),
      pendingPaise: BigInt(row?.pending_paise ?? 0),
    };
  });
}

export interface CollectionBreakdownRow {
  label: string;
  studentCount: number;
  receivablePaise: bigint;
  collectedPaise: bigint;
  pendingPaise: bigint;
}

export async function getBreakdownByClass(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<CollectionBreakdownRow[]> {
  const { data, error } = await supabase.rpc(
    "dashboard_breakdown_by_class",
    rpcArgs(scope),
  );
  if (error) {
    throw new Error("Could not load the by-class breakdown.");
  }
  return data.map((row) => ({
    label: row.class_section || "Unassigned",
    studentCount: Number(row.student_count),
    receivablePaise: BigInt(row.receivable_paise),
    collectedPaise: BigInt(row.collected_paise),
    pendingPaise: BigInt(row.pending_paise),
  }));
}

// "Group" is the route for transport and the slot for daycare -- one SQL
// function, since fee_account carries exactly one of the two per row.
export async function getBreakdownByGroup(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<CollectionBreakdownRow[]> {
  const { data, error } = await supabase.rpc(
    "dashboard_breakdown_by_group",
    rpcArgs(scope),
  );
  if (error) {
    throw new Error("Could not load the by-route breakdown.");
  }
  return data.map((row) => ({
    label: row.group_label || "Unassigned",
    studentCount: Number(row.student_count),
    receivablePaise: BigInt(row.receivable_paise),
    collectedPaise: BigInt(row.collected_paise),
    pendingPaise: BigInt(row.pending_paise),
  }));
}
