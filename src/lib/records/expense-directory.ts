import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ExpenseSortKey,
  ExpenseTableSearchParams,
  EXPENSE_SORT_KEYS,
} from "@/lib/shell/expense-table-params";
import { resolvePagination, type Pagination } from "@/lib/shell/pagination";
import { escapePostgrestFilterValue } from "@/lib/records/student-directory";

export interface ExpenseCategoryOption {
  id: string;
  name: string;
}

export interface ExpenseCategoryBreakdownRow {
  categoryId: string;
  categoryName: string;
  amountPaise: bigint;
}

export interface ExpenseCategoryBreakdown {
  rows: ExpenseCategoryBreakdownRow[];
  totalPaise: bigint;
}

// Scoped by year + branch only -- the same two params ScopeSelectors
// already control -- not by the list table's own category/method/date-
// range/search filters. Matches how the fee dashboards' stat cards are
// scoped by year/branch/month, never by a second table's filters.
export async function getExpenseCategoryBreakdown(
  supabase: SupabaseClient<Database>,
  params: { academicYearId: string; branch: "all" | string },
): Promise<ExpenseCategoryBreakdown> {
  const { data, error } = await supabase.rpc("expense_category_breakdown", {
    p_academic_year_id: params.academicYearId,
    p_branch_code: params.branch === "all" ? undefined : params.branch,
  });

  if (error) {
    throw new Error("Could not load the expense breakdown.");
  }

  const rows = data
    .filter(
      (row): row is typeof row & { category_id: string } =>
        row.category_id !== null,
    )
    .map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name ?? "",
      amountPaise: BigInt(row.amount_paise ?? 0),
    }));

  return {
    rows,
    totalPaise: rows.reduce((sum, row) => sum + row.amountPaise, 0n),
  };
}

// Active categories only, in sort_order -- the entry form's dropdown per
// the spec. Deliberately not getExpenseCategoriesWithStats (settings/
// queries.ts) -- that one is the admin management screen's own concern
// (counts, totals, every category including inactive ones) and pulls from
// the admin-only expense_category_summary view; this is a plain
// authenticated-for-everyone read the entry form needs regardless of role.
export async function getActiveExpenseCategoryOptions(
  supabase: SupabaseClient<Database>,
): Promise<ExpenseCategoryOption[]> {
  const { data, error } = await supabase
    .from("expense_category")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    throw new Error("Could not load expense categories.");
  }

  return data;
}

// Every category, active or not -- the list's filter dropdown, unlike the
// entry form's, needs to be able to find expenses recorded against a
// category that's since been deactivated.
export async function getAllExpenseCategoryOptions(
  supabase: SupabaseClient<Database>,
): Promise<ExpenseCategoryOption[]> {
  const { data, error } = await supabase
    .from("expense_category")
    .select("id, name")
    .order("sort_order");

  if (error) {
    throw new Error("Could not load expense categories.");
  }

  return data;
}

export interface ExpenseDirectoryRow {
  id: string;
  branchCode: string;
  branchName: string;
  categoryName: string;
  amountPaise: bigint;
  spentOn: string;
  method: string;
  reference: string;
  note: string;
  createdByName: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
}

export interface ExpenseDirectoryParams {
  // A teacher's own branch, clamped server-side regardless of what's in the
  // URL -- "all" (admin only) or a specific branch code, never trusted from
  // the client for a teacher caller.
  branch: "all" | string;
  academicYearId: string;
  table: ExpenseTableSearchParams;
}

export interface ExpenseDirectoryResult {
  rows: ExpenseDirectoryRow[];
  pagination: Pagination;
}

const SORT_COLUMN: Record<(typeof EXPENSE_SORT_KEYS)[number], string> = {
  spent_on: "spent_on",
  category_name: "category_name",
  amount_paise: "amount_paise",
};

function applyFilters(
  supabase: SupabaseClient<Database>,
  { branch, academicYearId, table }: ExpenseDirectoryParams,
  { head }: { head: boolean },
) {
  let query = supabase
    .from("expense_record")
    .select("*", { count: "exact", head })
    .eq("academic_year_id", academicYearId);

  if (branch !== "all") {
    query = query.eq("branch_code", branch);
  }
  if (table.category) {
    query = query.eq("category_id", table.category);
  }
  if (table.method !== "all") {
    query = query.eq("method", table.method);
  }
  if (table.from) {
    query = query.gte("spent_on", table.from);
  }
  if (table.to) {
    query = query.lte("spent_on", table.to);
  }
  if (table.q) {
    const q = escapePostgrestFilterValue(table.q);
    query = query.or(
      `category_name.ilike."%${q}%",reference.ilike."%${q}%",note.ilike."%${q}%"`,
    );
  }

  return query;
}

export async function getExpenseDirectory(
  supabase: SupabaseClient<Database>,
  params: ExpenseDirectoryParams & { page: number; pageSize: number },
): Promise<ExpenseDirectoryResult> {
  const { table, page, pageSize } = params;

  const { count: totalCount, error: countError } = await applyFilters(
    supabase,
    params,
    { head: true },
  );
  if (countError) {
    throw new Error("Could not load expenses.");
  }

  const pagination = resolvePagination(page, pageSize, totalCount ?? 0);

  const { data, error } = await applyFilters(supabase, params, {
    head: false,
  })
    .order(SORT_COLUMN[table.sort as ExpenseSortKey], {
      ascending: table.dir === "asc",
    })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw new Error("Could not load expenses.");
  }

  return {
    rows: data
      .filter((row): row is typeof row & { id: string } => row.id !== null)
      .map((row) => ({
        id: row.id,
        branchCode: row.branch_code ?? "",
        branchName: row.branch_name ?? "",
        categoryName: row.category_name ?? "",
        amountPaise: BigInt(row.amount_paise ?? 0),
        spentOn: row.spent_on ?? "",
        method: row.method ?? "",
        reference: row.reference ?? "",
        note: row.note ?? "",
        createdByName: row.created_by_name ?? "",
        updatedByName: row.updated_by_name ?? "",
        createdAt: row.created_at ?? "",
        updatedAt: row.updated_at ?? "",
        isEdited: row.updated_at !== row.created_at,
      })),
    pagination,
  };
}
