import { z } from "zod";

export const ACTIVITY_LOG_ACTIONS = ["create", "update", "delete"] as const;
export type ActivityLogAction = (typeof ACTIVITY_LOG_ACTIONS)[number];

export const ACTIVITY_LOG_ENTITIES = [
  "student",
  "fee_account",
  "payment",
  "expense",
  "expense_category",
  "student_submission",
  "profile",
] as const;
export type ActivityLogEntity = (typeof ACTIVITY_LOG_ENTITIES)[number];

// Deliberately just a shape check, not a real calendar-day check (Zod's
// regex can't accept/reject e.g. day 31 in a 30-day month) -- an invalid
// but well-shaped date just matches nothing in the query, same "fall back
// to default rather than 500" convention as every other param here.
const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const activityLogSearchParamsSchema = z.object({
  dateFrom: dateParam,
  dateTo: dateParam,
  branch: z.string().optional().catch(undefined),
  actor: z.string().optional().catch(undefined),
  action: z.enum([...ACTIVITY_LOG_ACTIONS, "all"]).catch("all"),
  entity: z.enum([...ACTIVITY_LOG_ENTITIES, "all"]).catch("all"),
  q: z.string().optional().catch(undefined),
  cursor: z.string().optional().catch(undefined),
});

export type ActivityLogSearchParams = z.infer<
  typeof activityLogSearchParamsSchema
>;

export function activityLogActiveFilterCount(
  params: ActivityLogSearchParams,
): number {
  return [
    params.dateFrom,
    params.dateTo,
    params.branch && params.branch !== "all" ? params.branch : undefined,
    params.actor && params.actor !== "all" ? params.actor : undefined,
    params.action !== "all" ? params.action : undefined,
    params.entity !== "all" ? params.entity : undefined,
  ].filter((value) => value !== undefined).length;
}
