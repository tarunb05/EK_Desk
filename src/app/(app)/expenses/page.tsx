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
  getExpenseMonthlyTotals,
  getExpenseYears,
} from "@/lib/records/expense-directory";
import { getBranches } from "@/lib/supabase/queries";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ExpenseFilters } from "@/components/expenses/expense-filters";
import { TotalExpensesCard } from "@/components/expenses/total-expenses-card";
import { CategoryBreakdownChart } from "@/components/expenses/category-breakdown-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { MonthColumns } from "@/components/charts/month-columns";
import { ScopeSelectors } from "@/components/shell/scope-selectors";
import { FilterMenu } from "@/components/shell/filter-menu";
import { SearchField } from "@/components/shell/search-field";
import { todayInIndia } from "@/lib/domain/datetime";
import { summarizeExpenseFilters } from "@/lib/domain/expense-filter-summary";
import {
  periodBounds,
  resolveExpenseDateRange,
} from "@/lib/domain/expense-month";

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
  const currentYear = Number(todayInIndia().slice(0, 4));
  const [{ branch }, branches, categories, availableYears] = await Promise.all([
    getCurrentScope(scopeParams),
    getBranches(supabase),
    getAllExpenseCategoryOptions(supabase),
    getExpenseYears(supabase, currentYear),
  ]);

  // A teacher's branch is clamped to their own regardless of what's in the
  // URL -- the branch selector isn't even rendered for them (see below), but
  // a hand-typed ?branch= must not widen the query either. getExpenseDirectory
  // filters by branch *code* (matching resolveYearAndBranch's own contract),
  // not the id profile.branch_id actually stores, so this resolves through
  // the branches list rather than passing the id straight through.
  const effectiveBranch =
    authed.role === "teacher"
      ? (branches.find((b) => b.id === authed.branchId)?.code ?? "all")
      : branch;

  // Year is a calendar year, this one unless the URL says otherwise; a year
  // typed into the URL is offered too, so the dropdown can always show it.
  const year = tableParams.year ?? String(currentYear);
  const years = Array.from(new Set([...availableYears, Number(year)])).sort(
    (a, b) => a - b,
  );
  const table = { ...tableParams, year };

  // Table, card and the selected part of each chart read the same filters,
  // so the figures always describe the rows below them. The charts also
  // keep the whole year in view (the same rule as the Transport and Daycare
  // dashboards): the category chart gets the year's spend per category with
  // only method and search applied, and the selection is drawn inside it.
  const [{ rows, pagination }, breakdown, yearBreakdown, monthlyTotals] =
    await Promise.all([
      getExpenseDirectory(supabase, {
        branch: effectiveBranch,
        table,
        page: tableParams.page,
        pageSize: PAGE_SIZE,
      }),
      getExpenseCategoryBreakdown(supabase, {
        branch: effectiveBranch,
        table,
      }),
      getExpenseCategoryBreakdown(supabase, {
        branch: effectiveBranch,
        table: {
          ...table,
          month: undefined,
          from: undefined,
          to: undefined,
          category: undefined,
        },
      }),
      getExpenseMonthlyTotals(supabase, {
        branch: effectiveBranch,
        year,
        table,
      }),
    ]);

  // A month, a From/To range or a category narrows the selection; year,
  // method and search shape the whole picture instead.
  const periodNarrowed = Boolean(table.month || table.from || table.to);
  const selectionNarrowed = periodNarrowed || Boolean(table.category);

  // The month chart always shows the whole year; the months inside the
  // filtered period stay slate and the rest go sand. Compared as ISO dates
  // against the one resolved range every other consumer uses (the month
  // filter is a bare number, "11", so it can't be matched to "2026-11"
  // directly).
  const period = resolveExpenseDateRange(table);
  const monthColumns = monthlyTotals.map(({ month, totalPaise }) => {
    const { from: monthStart, to: monthEnd } = periodBounds(
      year,
      String(Number(month.slice(5))),
    );
    const overlaps =
      (!period.from || monthEnd >= period.from) &&
      (!period.to || monthStart <= period.to);
    return {
      month,
      paise: totalPaise,
      dimmed: periodNarrowed && !overlaps,
    };
  });

  // "2026" alone means the whole year, so say so; anything more specific
  // (a month, a category...) is named in full.
  const activeFilters = summarizeExpenseFilters({
    year,
    month: table.month,
    from: table.from,
    to: table.to,
    categoryName: categories.find((c) => c.id === table.category)?.name,
    method: table.method,
    q: table.q,
  });
  const cardCaption =
    activeFilters.length > 1 || table.month
      ? activeFilters.join(" · ")
      : `All expenses · ${year}`;

  // The card's Excel link carries the same filters.
  const exportParams = new URLSearchParams({
    branch: effectiveBranch,
    year,
  });
  for (const [key, value] of Object.entries({
    month: table.month,
    category: table.category,
    method: table.method === "all" ? undefined : table.method,
    from: table.from,
    to: table.to,
    q: table.q,
  })) {
    if (value) exportParams.set(key, value);
  }

  const flatSearchParams = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h1 className="text-2xl font-semibold text-ink">Expenses</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            ariaLabel="Search by category, reference, or note"
            placeholder="Search"
            className="w-56"
          />
          <FilterMenu>
            {authed.role === "admin" ? (
              <ScopeSelectors branches={branches} />
            ) : null}
            <ExpenseFilters
              categories={categories}
              years={years}
              year={year}
              month={table.month ?? ""}
            />
          </FilterMenu>
          <Link
            href="/expenses/new"
            className="inline-block h-9 rounded-full bg-accent px-4 text-sm font-medium leading-9 text-surface transition-[background-color,transform] duration-150 hover:bg-accent/90 active:scale-[0.98]"
          >
            Record expense
          </Link>
        </div>
      </div>

      {/* Two equal columns: the headline figure over the year by month on
          the left, the category list on the right. The list needs the
          width -- in a narrow third its bars shrink to stubs. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <TotalExpensesCard
            totalPaise={breakdown.totalPaise}
            caption={cardCaption}
            exportHref={`/api/export/expenses?${exportParams.toString()}`}
          />
          <ChartCard
            title="Spent each month"
            caption={
              periodNarrowed
                ? `${year}, filtered months in slate`
                : `Calendar year ${year}`
            }
            className="flex-1"
          >
            <MonthColumns
              columns={monthColumns}
              valueLabel="Spent"
              emptyText={`No expenses recorded in ${year} yet. Record one and it appears here under its month.`}
            />
          </ChartCard>
        </div>

        <ChartCard
          title="By category"
          caption={
            selectionNarrowed
              ? "Share of the selection, inside the year"
              : "Share of the total"
          }
        >
          <CategoryBreakdownChart
            yearRows={[...yearBreakdown.rows].sort((a, b) =>
              a.amountPaise === b.amountPaise
                ? a.categoryName.localeCompare(b.categoryName)
                : a.amountPaise > b.amountPaise
                  ? -1
                  : 1,
            )}
            selectedRows={breakdown.rows}
            selectedTotalPaise={breakdown.totalPaise}
            filtered={selectionNarrowed}
            year={year}
          />
        </ChartCard>
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
