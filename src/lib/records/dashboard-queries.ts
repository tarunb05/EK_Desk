import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AgeingBucket } from "@/lib/domain/types";
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

export interface AgeingBucketSummary {
  bucket: AgeingBucket;
  accountCount: number;
  pendingPaise: bigint;
}

export interface MonthCollection {
  month: string;
  collectedPaise: bigint;
}

export interface GroupBreakdown {
  label: string;
  studentCount: number;
  receivablePaise: bigint;
  collectedPaise: bigint;
  pendingPaise: bigint;
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

export async function getAgeingBuckets(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<AgeingBucketSummary[]> {
  const { data, error } = await supabase.rpc(
    "dashboard_ageing_buckets",
    rpcArgs(scope),
  );
  if (error) {
    throw new Error("Could not load ageing buckets.");
  }
  return data.map((row) => ({
    bucket: row.bucket as AgeingBucket,
    accountCount: Number(row.account_count),
    pendingPaise: BigInt(row.pending_paise),
  }));
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

export async function getBreakdownByClass(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<GroupBreakdown[]> {
  const { data, error } = await supabase.rpc(
    "dashboard_breakdown_by_class",
    rpcArgs(scope),
  );
  if (error) {
    throw new Error("Could not load the class breakdown.");
  }
  return data.map((row) => ({
    label: row.class_section ?? "",
    studentCount: Number(row.student_count),
    receivablePaise: BigInt(row.receivable_paise),
    collectedPaise: BigInt(row.collected_paise),
    pendingPaise: BigInt(row.pending_paise),
  }));
}

export async function getBreakdownByGroup(
  supabase: SupabaseClient<Database>,
  scope: DashboardScope,
): Promise<GroupBreakdown[]> {
  const { data, error } = await supabase.rpc(
    "dashboard_breakdown_by_group",
    rpcArgs(scope),
  );
  if (error) {
    throw new Error("Could not load the route/slot breakdown.");
  }
  return data.map((row) => ({
    label: row.group_label ?? "",
    studentCount: Number(row.student_count),
    receivablePaise: BigInt(row.receivable_paise),
    collectedPaise: BigInt(row.collected_paise),
    pendingPaise: BigInt(row.pending_paise),
  }));
}
