import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getExpenseCategoriesWithStats } from "@/lib/settings/queries";
import { AddExpenseCategoryForm } from "@/components/settings/add-expense-category-form";
import { ExpenseCategoryRow } from "@/components/settings/expense-category-row";

export const metadata: Metadata = {
  title: "Expense Categories",
};

export default async function ExpenseCategoriesPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const categories = await getExpenseCategoriesWithStats(supabase);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href="/settings"
          className="text-xs text-ink-secondary transition-colors duration-150 hover:text-ink"
        >
          ← Settings
        </Link>
        <h1 className="text-xl font-medium text-ink">Expense categories</h1>
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
        {categories.length > 0 ? (
          <ul className="flex flex-col divide-y divide-hairline">
            {categories.map((category, index) => (
              <ExpenseCategoryRow
                key={category.id}
                category={category}
                isFirst={index === 0}
                isLast={index === categories.length - 1}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-secondary">
            No categories yet — add the first one below.
          </p>
        )}

        <AddExpenseCategoryForm />
      </section>
    </div>
  );
}
