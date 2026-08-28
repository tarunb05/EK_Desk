import { z } from "zod";
import {
  STUDENT_SORT_KEYS,
  STUDENT_STATUS_FILTERS,
  STUDENT_SERVICE_FILTERS,
} from "@/lib/shell/student-table-params";

// Split out of student-table-params.ts on purpose -- this is the only
// consumer of zod for the Students directory, and it's only ever parsed
// server-side (page.tsx, and the query layer for the resulting type). Keeping
// it out of student-table-params.ts keeps that file safe for the client
// filters component to import without dragging zod into the browser bundle.

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
  // The academic year's label, not id -- matches the URL-as-state
  // convention every other filter here uses. Absent/unmatched means "all
  // years", not the current year -- this filter narrows an otherwise
  // year-agnostic directory, it doesn't default to scoping it.
  academicYear: z.string().optional(),
  // Filters by created_at (the table's own "Date added" column) -- the
  // only date field a student itself has; due dates live on the fee
  // account, not the student.
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(STUDENT_SORT_KEYS).catch("created_at"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export type StudentDirectorySearchParams = z.infer<
  typeof studentDirectorySearchParamsSchema
>;
