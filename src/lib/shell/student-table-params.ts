import { z } from "zod";

export const STUDENT_SORT_KEYS = [
  "created_at",
  "full_name",
  "admission_no",
  "class_section",
] as const;
export type StudentSortKey = (typeof STUDENT_SORT_KEYS)[number];

// A single filter covering both the student's lifecycle status (active vs
// soft-deleted) and their aggregate payment status across every fee_account
// they have, in either service, in any year. "overdue"/"pending"/"paid" all
// implicitly scope to active students — filtering deleted students by
// payment status isn't a thing anyone asked for, and deleted students are
// already reachable via the "inactive" option.
export const STUDENT_STATUS_FILTERS = [
  "active",
  "inactive",
  "overdue",
  "pending",
  "paid",
  "all",
] as const;
export type StudentStatusFilter = (typeof STUDENT_STATUS_FILTERS)[number];

export const STUDENT_SERVICE_FILTERS = ["all", "transport", "daycare"] as const;
export type StudentServiceFilter = (typeof STUDENT_SERVICE_FILTERS)[number];

const pageParam = z
  .string()
  .optional()
  .transform((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  });

export const studentDirectorySearchParamsSchema = z.object({
  page: pageParam,
  status: z.enum(STUDENT_STATUS_FILTERS).catch("active"),
  service: z.enum(STUDENT_SERVICE_FILTERS).catch("all"),
  classSection: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(STUDENT_SORT_KEYS).catch("created_at"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export type StudentDirectorySearchParams = z.infer<
  typeof studentDirectorySearchParamsSchema
>;
