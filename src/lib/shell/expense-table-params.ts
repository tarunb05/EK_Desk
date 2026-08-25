import { z } from "zod";
import { MONEY_METHODS } from "@/lib/domain/money";

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
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(EXPENSE_SORT_KEYS).catch("spent_on"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export type ExpenseTableSearchParams = z.infer<
  typeof expenseTableSearchParamsSchema
>;
