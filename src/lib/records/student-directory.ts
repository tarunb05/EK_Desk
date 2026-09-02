import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  StudentServiceFilter,
  STUDENT_SORT_KEYS,
} from "@/lib/shell/student-table-params";
import type { StudentDirectorySearchParams } from "@/lib/shell/student-search-params";
import { resolvePagination, type Pagination } from "@/lib/shell/pagination";
import type { ServiceType } from "@/lib/records/types";

export interface StudentFeeAccountRef {
  feeAccountId: string;
  serviceType: ServiceType;
  academicYearLabel: string;
  status: "active" | "discontinued";
}

export interface StudentDirectoryRow {
  id: string;
  fullName: string;
  admissionNo: string;
  classSection: string;
  branchCode: string;
  branchName: string;
  phone: string;
  guardianName: string;
  status: string;
  createdAt: string;
  feeAccountCount: number;
  totalPendingPaise: bigint;
  hasOverdue: boolean;
  hasTransport: boolean;
  hasDaycare: boolean;
  feeAccounts: StudentFeeAccountRef[];
}

export interface StudentDirectoryParams {
  branch: "all" | string;
  service: StudentServiceFilter;
  // Resolved server-side from the table.academicYear label -- undefined
  // means "all years", not "the current year".
  academicYearId?: string;
  table: StudentDirectorySearchParams;
}

export interface StudentDirectoryResult {
  rows: StudentDirectoryRow[];
  pagination: Pagination;
}

const SORT_COLUMN: Record<(typeof STUDENT_SORT_KEYS)[number], string> = {
  full_name: "full_name",
  admission_no: "admission_no",
  class_section: "class_section",
  created_at: "created_at",
};

// PostgREST's .or() filter takes a raw filter-syntax string, not a
// parameterized value — a search term containing "," or ")" would otherwise
// close the current clause and let the user append arbitrary additional
// filter conditions. Wrapping the value in double quotes (with internal
// backslashes/quotes escaped) makes PostgREST treat everything inside as a
// literal, per its own documented escaping rule, closing that off.
export function escapePostgrestFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function applyFilters(
  supabase: SupabaseClient<Database>,
  { branch, service, academicYearId, table }: StudentDirectoryParams,
  { head }: { head: boolean },
) {
  let query = supabase
    .from("student_directory")
    .select("*", { count: "exact", head });

  if (branch !== "all") {
    query = query.eq("branch_code", branch);
  }
  if (academicYearId) {
    query = query.contains("academic_year_ids", [academicYearId]);
  }
  if (service === "transport") {
    query = query.eq("has_transport", true);
  } else if (service === "daycare") {
    query = query.eq("has_daycare", true);
  }

  switch (table.status) {
    case "active":
      query = query.eq("status", "active");
      break;
    case "inactive":
      query = query.eq("status", "inactive");
      break;
    case "overdue":
      query = query.eq("status", "active").eq("has_overdue", true);
      break;
    case "pending":
      query = query.eq("status", "active").gt("total_pending_paise", 0);
      break;
    case "paid":
      query = query
        .eq("status", "active")
        .gt("fee_account_count", 0)
        .lte("total_pending_paise", 0);
      break;
    case "all":
      break;
  }

  if (table.classSection) {
    query = query.eq("class_section", table.classSection);
  }
  if (table.dateFrom) {
    query = query.gte("created_at", table.dateFrom);
  }
  if (table.dateTo) {
    // created_at is a full timestamp, not a bare date -- a straight lte on
    // the date string would exclude every row from that day after
    // midnight. Bumping to the start of the next day makes "to" inclusive
    // of its whole day, matching what picking that day in the calendar
    // implies. Plain UTC arithmetic on the parsed components, not
    // new Date("YYYY-MM-DD") + local setDate() -- mixing a UTC-parsed date
    // with local-timezone mutation is exactly the kind of off-by-one this
    // codebase already hit once (date-field.tsx's fromIso).
    const [y, m, d] = table.dateTo.split("-").map(Number);
    const nextDay = new Date(Date.UTC(y!, m! - 1, d! + 1));
    query = query.lt("created_at", nextDay.toISOString().slice(0, 10));
  }
  if (table.q) {
    const q = escapePostgrestFilterValue(table.q);
    query = query.or(`full_name.ilike."%${q}%",admission_no.ilike."%${q}%"`);
  }

  return query;
}

export async function getStudentDirectory(
  supabase: SupabaseClient<Database>,
  params: StudentDirectoryParams & { page: number; pageSize: number },
): Promise<StudentDirectoryResult> {
  const { table, page, pageSize } = params;

  const { count: totalCount, error: countError } = await applyFilters(
    supabase,
    params,
    { head: true },
  );
  if (countError) {
    throw new Error("Could not load students.");
  }

  const pagination = resolvePagination(page, pageSize, totalCount ?? 0);

  const { data, error } = await applyFilters(supabase, params, {
    head: false,
  })
    .order(SORT_COLUMN[table.sort], { ascending: table.dir === "asc" })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw new Error("Could not load students.");
  }

  return {
    rows: data.map((row) => {
      const feeAccounts = Array.isArray(row.fee_accounts)
        ? (
            row.fee_accounts as unknown as {
              feeAccountId: string | null;
              serviceType: string | null;
              academicYearLabel: string | null;
              status: string | null;
            }[]
          )
            .filter(
              (
                fa,
              ): fa is {
                feeAccountId: string;
                serviceType: string;
                academicYearLabel: string;
                status: string;
              } => !!fa.feeAccountId && !!fa.serviceType,
            )
            .map((fa) => ({
              feeAccountId: fa.feeAccountId,
              serviceType: fa.serviceType as ServiceType,
              academicYearLabel: fa.academicYearLabel ?? "",
              status: (fa.status ?? "active") as "active" | "discontinued",
            }))
        : [];

      return {
        id: row.id ?? "",
        fullName: row.full_name ?? "",
        admissionNo: row.admission_no ?? "",
        classSection: row.class_section ?? "",
        branchCode: row.branch_code ?? "",
        branchName: row.branch_name ?? "",
        phone: row.phone ?? "",
        guardianName: row.guardian_name ?? "",
        status: row.status ?? "active",
        createdAt: row.created_at ?? "",
        feeAccountCount: row.fee_account_count ?? 0,
        totalPendingPaise: BigInt(row.total_pending_paise ?? 0),
        hasOverdue: row.has_overdue ?? false,
        hasTransport: row.has_transport ?? false,
        hasDaycare: row.has_daycare ?? false,
        feeAccounts,
      };
    }),
    pagination,
  };
}

export async function getStudentClassSections(
  supabase: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("student")
    .select("class_section");

  if (error) {
    throw new Error("Could not load class sections.");
  }

  const unique = new Set(data.map((row) => row.class_section));
  return [...unique].sort();
}
