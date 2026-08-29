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

const monthParam = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .optional()
  .catch(undefined);

// Deliberately just a shape check, not a real calendar-day check (Zod's
// regex can't know what a valid day is for a given month) -- the actual
// clamp to the selected month happens two places: the day <input> itself
// (min/max, so the browser UI can't offer an out-of-range date to begin
// with) and getActivityLogPage silently ignoring a day outside month
// bounds if one still arrives via a hand-edited URL, same "fall back to
// default rather than 500" convention as every other param here.
const dayParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const activityLogSearchParamsSchema = z.object({
  month: monthParam,
  day: dayParam,
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

// A day outside the selected month can only reach the server via a
// hand-edited URL -- the day <input>'s own min/max already stop the UI
// from offering one. Falls back to "no day filter" rather than throwing,
// same convention as every other param in this schema; a full inline
// "that day isn't in this month" error for a URL nobody would type by hand
// wasn't worth building.
export function clampDayToMonth(
  day: string | undefined,
  month: string | undefined,
): string | undefined {
  if (!day) return undefined;
  if (!month) return day;
  return day.startsWith(month) ? day : undefined;
}

export function activityLogActiveFilterCount(
  params: ActivityLogSearchParams,
): number {
  return [
    params.month,
    params.day,
    params.branch && params.branch !== "all" ? params.branch : undefined,
    params.actor && params.actor !== "all" ? params.actor : undefined,
    params.action !== "all" ? params.action : undefined,
    params.entity !== "all" ? params.entity : undefined,
  ].filter((value) => value !== undefined).length;
}
