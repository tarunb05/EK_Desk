// Plain constants and types only, deliberately zod-free -- this file is
// imported by StudentDirectoryFilters ("use client"), and a module-level
// zod schema living here would ship the whole zod runtime (plus its locale
// data) to the browser just because one export from the same file is used
// client-side. The URL search-params schema that actually needs zod lives
// in ./student-search-params.ts instead, imported only by the server side
// (page.tsx and the query layer).

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
