import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import { expenseTableSearchParamsSchema } from "@/lib/shell/expense-table-params";
import { requireAuth } from "@/lib/auth/require-role";
import {
  getAllExpenseCategoryOptions,
  getExpenseCategoryBreakdown,
  getExpenseDirectory,
} from "@/lib/records/expense-directory";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ExpenseFilters } from "@/components/expenses/expense-filters";
import { TotalExpensesCard } from "@/components/expenses/total-expenses-card";
import { CategoryBreakdownChart } from "@/components/expenses/category-breakdown-chart";
import { ScopeSelectors } from "@/components/shell/scope-selectors";
import { FilterMenu } from "@/components/shell/filter-menu";
import { SearchField } from "@/components/shell/search-field";
import { CalendarIcon } from "@/components/shell/nav-icons";

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "Expenses",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const scopeParams = shellSearchParamsSchema.parse(rawParams);
  const tableParams = expenseTableSearchParamsSchema.parse(rawParams);

  const authed = await requireAuth();
  const supabase = await createClient();
  const [{ year, branch }, branches, years, categories] = await Promise.all([
    getCurrentScope(scopeParams),
    getBranches(supabase),
    getAcademicYears(supabase),
    getAllExpenseCategoryOptions(supabase),
  ]);

  // A teacher's branch is clamped to their own regardless of what's in the
  // URL -- the scope selector isn't even rendered for them (see below), but
  // a hand-typed ?branch= must not widen the query either. getExpenseDirectory
  // filters by branch *code* (matching resolveYearAndBranch's own contract),
  // not the id profile.branch_id actually stores, so this resolves through
  // the branches list rather than passing the id straight through.
  const effectiveBranch =
    authed.role === "teacher"
      ? (branches.find((b) => b.id === authed.branchId)?.code ?? "all")
      : branch;

  const [{ rows, pagination }, breakdown] = await Promise.all([
    getExpenseDirectory(supabase, {
      branch: effectiveBranch,
      academicYearId: year.id,
      table: tableParams,
      page: tableParams.page,
      pageSize: PAGE_SIZE,
    }),
    getExpenseCategoryBreakdown(supabase, {
      branch: effectiveBranch,
      academicYearId: year.id,
    }),
  ]);

  const flatSearchParams = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium text-ink">Expenses</h1>

      <div className="flex items-center justify-end gap-2">
        <SearchField
          ariaLabel="Search by category, reference, or note"
          placeholder="Search"
          className="w-56"
        />
        <FilterMenu>
          {authed.role === "admin" ? (
            <ScopeSelectors years={years} branches={branches} />
          ) : (
            <div className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm text-ink-secondary">
              <CalendarIcon size={14} />
              Year
              <span className="text-ink">{year.label}</span>
            </div>
          )}
          <ExpenseFilters categories={categories} />
        </FilterMenu>
        <Link
          href="/expenses/new"
          className="inline-block h-9 rounded-md bg-accent px-4 text-sm font-medium leading-9 text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
        >
          Record expense
        </Link>
      </div>

      <TotalExpensesCard
        totalPaise={breakdown.totalPaise}
        academicYearId={year.id}
        branch={effectiveBranch}
      />

      <div className="flex flex-col gap-2">
        <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          By category
        </h2>
        <CategoryBreakdownChart
          rows={breakdown.rows}
          totalPaise={breakdown.totalPaise}
        />
      </div>

      <ExpenseTable
        rows={rows}
        sort={tableParams.sort}
        dir={tableParams.dir}
        page={pagination.page}
        totalPages={pagination.totalPages}
        searchParams={flatSearchParams}
        role={authed.role}
      />
    </div>
  );
}
