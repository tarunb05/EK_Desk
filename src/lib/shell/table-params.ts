import { z } from "zod";

export const SORT_KEYS = [
  "full_name",
  "pending_paise",
  "collected_paise",
  "total_receivable_paise",
  "due_date",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const STATUS_FILTERS = ["all", "overdue", "pending", "paid"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const pageParam = z
  .string()
  .optional()
  .transform((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  });

export const recordTableSearchParamsSchema = z.object({
  page: pageParam,
  status: z.enum(STATUS_FILTERS).catch("all"),
  classSection: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(SORT_KEYS).catch("full_name"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
});

export type RecordTableSearchParams = z.infer<
  typeof recordTableSearchParamsSchema
>;
