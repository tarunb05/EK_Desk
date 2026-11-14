import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ExpenseSortKey,
  ExpenseTableSearchParams,
  EXPENSE_SORT_KEYS,
} from "@/lib/shell/expense-table-params";
import { resolvePagination, type Pagination } from "@/lib/shell/pagination";
import { escapePostgrestFilterValue } from "@/lib/records/student-directory";
import { resolveExpenseDateRange } from "@/lib/domain/expense-month";

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

// The filters the list, the card, the category chart and the Excel export
// all share. Year, month and the custom From/To range are folded into one
// date range here, in one place, so none of them can read the URL differently.
type ExpenseFilterInput = Pick<
  ExpenseTableSearchParams,
  "category" | "method" | "year" | "month" | "from" | "to" | "q"
>;

function normalizeFilters(table: ExpenseFilterInput) {
  const { from, to } = resolveExpenseDateRange(table);
  return {
    category: table.category || undefined,
    method: table.method === "all" ? undefined : table.method,
    from,
    to,
    q: table.q || undefined,
  };
}

// Follows the same filters as the list below it -- branch, category, method,
// year / month / date range and search -- so the card total and the chart
// always describe the rows in the table. Aggregated in Postgres
// (expense_category_breakdown), not summed from fetched rows.
export async function getExpenseCategoryBreakdown(
  supabase: SupabaseClient<Database>,
  params: {
    branch: "all" | string;
    table: ExpenseFilterInput;
  },
): Promise<ExpenseCategoryBreakdown> {
  const filters = normalizeFilters(params.table);
  const { data, error } = await supabase.rpc("expense_category_breakdown", {
    p_branch_code: params.branch === "all" ? undefined : params.branch,
    p_category_id: filters.category,
    p_method: filters.method,
    p_from: filters.from,
    p_to: filters.to,
    p_q: filters.q,
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

// The calendar years the Year filter offers: every year from the earliest to
// the latest expense in scope (RLS keeps a teacher to their own branch), plus
// the current year, so there is always something to pick and a year with no
// expenses yet is still reachable. Oldest first.
export async function getExpenseYears(
  supabase: SupabaseClient<Database>,
  currentYear: number,
): Promise<number[]> {
  const [earliest, latest] = await Promise.all([
    supabase
      .from("expense")
      .select("spent_on")
      .order("spent_on", { ascending: true })
      .limit(1),
    supabase
      .from("expense")
      .select("spent_on")
      .order("spent_on", { ascending: false })
      .limit(1),
  ]);

  if (earliest.error || latest.error) {
    throw new Error("Could not load the expense years.");
  }

  const first = Number(earliest.data[0]?.spent_on.slice(0, 4) ?? currentYear);
  const last = Number(latest.data[0]?.spent_on.slice(0, 4) ?? currentYear);
  const low = Math.min(first, currentYear);
  const high = Math.max(last, currentYear);

  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

export interface ExpenseDirectoryParams {
  // A teacher's own branch, clamped server-side regardless of what's in the
  // URL -- "all" (admin only) or a specific branch code, never trusted from
  // the client for a teacher caller.
  branch: "all" | string;
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
  { branch, table }: ExpenseDirectoryParams,
  { head }: { head: boolean },
) {
  const filters = normalizeFilters(table);
  let query = supabase
    .from("expense_record")
    .select("*", { count: "exact", head });

  if (branch !== "all") {
    query = query.eq("branch_code", branch);
  }
  if (filters.category) {
    query = query.eq("category_id", filters.category);
  }
  if (filters.method) {
    query = query.eq("method", filters.method);
  }
  if (filters.from) {
    query = query.gte("spent_on", filters.from);
  }
  if (filters.to) {
    query = query.lte("spent_on", filters.to);
  }
  if (filters.q) {
    const q = escapePostgrestFilterValue(filters.q);
    query = query.or(
      `category_name.ilike."%${q}%",reference.ilike."%${q}%",note.ilike."%${q}%"`,
    );
  }

  return query;
}

// Every expense matching the current filters, unpaginated -- backs the
// "Total expenses" card's Excel export, so the file holds exactly the rows
// the card adds up.
export async function getAllExpenses(
  supabase: SupabaseClient<Database>,
  params: ExpenseDirectoryParams,
): Promise<ExpenseDirectoryRow[]> {
  const { data, error } = await applyFilters(supabase, params, {
    head: false,
  }).order("spent_on", { ascending: false });

  if (error) {
    throw new Error("Could not load expenses for export.");
  }

  return data
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
    }));
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

export interface ExpenseMonthTotal {
  // "2026-04"
  month: string;
  totalPaise: bigint;
}

// Spend for each of the twelve months of one calendar year, under the same
// branch / category / method / search filters as the list -- but not its
// month or From/To filter, since the point of the chart is to show the
// chosen month against the other eleven.
//
// Twelve calls to the existing expense_category_breakdown function (one per
// month, in parallel), each summed in Postgres -- chosen over a new
// expense_by_month SQL function so this needs no migration; if the page
// ever feels slow, that function is the replacement.
export async function getExpenseMonthlyTotals(
  supabase: SupabaseClient<Database>,
  params: {
    branch: "all" | string;
    year: string;
    table: Pick<ExpenseTableSearchParams, "category" | "method" | "q">;
  },
): Promise<ExpenseMonthTotal[]> {
  const year = Number(params.year);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    // Day 0 of the following month is the last day of this one.
    const lastDay = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
    return {
      month: `${year}-${month}`,
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
    };
  });

  return Promise.all(
    months.map(async ({ month, from, to }) => {
      const { data, error } = await supabase.rpc("expense_category_breakdown", {
        p_branch_code: params.branch === "all" ? undefined : params.branch,
        p_category_id: params.table.category || undefined,
        p_method:
          params.table.method === "all" ? undefined : params.table.method,
        p_from: from,
        p_to: to,
        p_q: params.table.q || undefined,
      });
      if (error) {
        throw new Error("Could not load expenses by month.");
      }
      return {
        month,
        totalPaise: data.reduce(
          (sum, row) => sum + BigInt(row.amount_paise ?? 0),
          0n,
        ),
      };
    }),
  );
}
