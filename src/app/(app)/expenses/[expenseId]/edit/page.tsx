import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBranches } from "@/lib/supabase/queries";
import { requireAuth } from "@/lib/auth/require-role";
import { getActiveExpenseCategoryOptions } from "@/lib/records/expense-directory";
import { paiseToRupeesInputString } from "@/lib/domain/money";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { BackLink } from "@/components/shell/back-link";

export const metadata: Metadata = {
  title: "Edit Expense",
};

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;
  const authed = await requireAuth();
  const supabase = await createClient();

  // RLS already scopes this to the caller's own branch for a teacher --
  // another branch's expense id resolves to no row, same as a genuinely
  // missing one, and both become a 404 rather than a leaked "not yours".
  const { data: expense, error } = await supabase
    .from("expense")
    .select(
      "id, branch_id, academic_year_id, category_id, amount_paise, spent_on, method, reference, note",
    )
    .eq("id", expenseId)
    .single();

  if (error || !expense) {
    notFound();
  }

  const [branches, activeCategories] = await Promise.all([
    getBranches(supabase),
    getActiveExpenseCategoryOptions(supabase),
  ]);

  // The entry form's dropdown is active-only, but this expense might
  // reference a category that's since been deactivated -- it still needs
  // to appear as the selected option, or the Select would render with
  // nothing chosen.
  const categories = activeCategories.some((c) => c.id === expense.category_id)
    ? activeCategories
    : [
        ...(await (async () => {
          const { data } = await supabase
            .from("expense_category")
            .select("id, name")
            .eq("id", expense.category_id)
            .single();
          return data ? [data] : [];
        })()),
        ...activeCategories,
      ];

  const teacherBranchName = branches.find(
    (branch) => branch.id === authed.branchId,
  )?.name;

  return (
    <div className="max-w-xl">
      <BackLink href="/expenses" />
      <h1 className="mb-4 text-xl font-medium text-ink">Edit expense</h1>
      <ExpenseForm
        mode="edit"
        expenseId={expense.id}
        role={authed.role}
        teacherBranchName={teacherBranchName}
        branches={branches}
        categories={categories}
        academicYearId={expense.academic_year_id}
        defaultValues={{
          categoryId: expense.category_id,
          amountRupees: paiseToRupeesInputString(BigInt(expense.amount_paise)),
          spentOn: expense.spent_on,
          method: expense.method,
          reference: expense.reference ?? "",
          note: expense.note ?? "",
          branchId: expense.branch_id,
        }}
      />
    </div>
  );
}
