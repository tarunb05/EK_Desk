import { z } from "zod";
import { MONEY_METHODS } from "@/lib/domain/money";
import { isMonth, isYear } from "@/lib/domain/expense-month";

export const EXPENSE_SORT_KEYS = [
  "spent_on",
  "category_name",
  "amount_paise",
] as const;
export type ExpenseSortKey = (typeof EXPENSE_SORT_KEYS)[number];

const pageParam = z
  .string()
  .optional()
  .transform((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  });

export const expenseTableSearchParamsSchema = z.object({
  page: pageParam,
  category: z.string().optional(),
  method: z.enum([...MONEY_METHODS, "all"]).catch("all"),
  // Calendar year ("2026") and month number ("11" = November, no year -- the
  // year comes from `year`). Anything else is treated as not set.
  year: z.string().refine(isYear).optional().catch(undefined),
  month: z.string().refine(isMonth).optional().catch(undefined),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(EXPENSE_SORT_KEYS).catch("spent_on"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export type ExpenseTableSearchParams = z.infer<
  typeof expenseTableSearchParamsSchema
>;
