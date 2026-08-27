import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import { requireAuth } from "@/lib/auth/require-role";
import { getActiveExpenseCategoryOptions } from "@/lib/records/expense-directory";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { BackLink } from "@/components/shell/back-link";

export const metadata: Metadata = {
  title: "Record Expense",
};

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = shellSearchParamsSchema.parse(await searchParams);
  const authed = await requireAuth();
  const supabase = await createClient();
  const [branches, categories, scope] = await Promise.all([
    getBranches(supabase),
    getActiveExpenseCategoryOptions(supabase),
    getCurrentScope(params),
  ]);

  const teacherBranchName = branches.find(
    (branch) => branch.id === authed.branchId,
  )?.name;

  return (
    <div className="max-w-xl">
      <BackLink href="/expenses" />
      <h1 className="mb-4 text-xl font-medium text-ink">Record expense</h1>
      <ExpenseForm
        mode="create"
        role={authed.role}
        teacherBranchName={teacherBranchName}
        branches={branches}
        categories={categories}
        academicYearId={scope.year.id}
      />
    </div>
  );
}
