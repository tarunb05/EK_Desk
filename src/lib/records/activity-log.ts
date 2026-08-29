import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  decodeActivityLogCursor,
  encodeActivityLogCursor,
} from "@/lib/shell/keyset-cursor";
import {
  clampDayToMonth,
  type ActivityLogAction,
  type ActivityLogEntity,
} from "@/lib/shell/activity-log-search-params";

// IST, not the query's own timezone -- see datetime.ts's own comment.
// occurred_at is timestamptz, so appending a fixed offset here (rather
// than relying on the server's local time) is what makes "August" mean
// the same calendar month regardless of where this code happens to run.
const IST_OFFSET = "+05:30";

function monthRange(month: string): { gte: string; lt: string } {
  const [year, monthNum] = month.split("-").map(Number);
  const nextMonth = monthNum! === 12 ? 1 : monthNum! + 1;
  const nextYear = monthNum! === 12 ? year! + 1 : year!;
  return {
    gte: `${month}-01T00:00:00${IST_OFFSET}`,
    lt: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00${IST_OFFSET}`,
  };
}

function dayRange(day: string): { gte: string; lt: string } {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, date! + 1));
  const nextDay = next.toISOString().slice(0, 10);
  return {
    gte: `${day}T00:00:00${IST_OFFSET}`,
    lt: `${nextDay}T00:00:00${IST_OFFSET}`,
  };
}

export const ACTIVITY_LOG_PAGE_SIZE = 50;

export interface ActivityLogRow {
  id: number;
  occurredAt: string;
  actorLabel: string;
  actorRole: string | null;
  action: "create" | "update" | "delete";
  entity: string;
  entityId: string | null;
  entityLabel: string;
  summary: string;
  changedFields: string[] | null;
  branchId: string | null;
  academicYearId: string | null;
  beforeAmountPaise: bigint | null;
  afterAmountPaise: bigint | null;
}

export interface ActivityLogPage {
  rows: ActivityLogRow[];
  nextCursor: string | null;
  // Only populated when rows is empty and no filter is active -- the
  // seeded bootstrap row's own date, for the empty state's "This log
  // starts from ..." sentence. Null is not a real case (the migration
  // seeds exactly one 'system' row and nothing deletes it), but the type
  // stays honest about a lookup that could in principle come back empty.
  seededAt: string | null;
  filtersActive: boolean;
}

// The 'system' row the migration seeds is a floor date for the empty
// state, not a real event -- it never appears in the list itself.
const REAL_ENTITY_FILTER = "system";

export interface ActivityLogFilters {
  month?: string;
  day?: string;
  branchId?: string;
  actorId?: string;
  action?: ActivityLogAction;
  entity?: ActivityLogEntity;
  q?: string;
}

function hasAnyFilter(filters: ActivityLogFilters): boolean {
  return (
    filters.month !== undefined ||
    filters.day !== undefined ||
    filters.branchId !== undefined ||
    filters.actorId !== undefined ||
    filters.action !== undefined ||
    filters.entity !== undefined ||
    (filters.q !== undefined && filters.q.length > 0)
  );
}

const ACTIVITY_LOG_SELECT =
  "id, occurred_at, actor_label, actor_role, action, entity, entity_id, entity_label, summary, changed_fields, branch_id, academic_year_id, before_amount_paise, after_amount_paise";

interface RawActivityLogRow {
  id: number;
  occurred_at: string;
  actor_label: string;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  entity_label: string;
  summary: string;
  changed_fields: string[] | null;
  branch_id: string | null;
  academic_year_id: string | null;
  before_amount_paise: number | null;
  after_amount_paise: number | null;
}

// Shared by getActivityLogPage and getAllActivityLogRows -- see
// applyActivityLogFilters's own comment for why these two functions split
// the query in the first place.
function mapActivityLogRow(row: RawActivityLogRow): ActivityLogRow {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorLabel: row.actor_label,
    actorRole: row.actor_role,
    action: row.action as ActivityLogRow["action"],
    entity: row.entity,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    summary: row.summary,
    changedFields: row.changed_fields,
    branchId: row.branch_id,
    academicYearId: row.academic_year_id,
    beforeAmountPaise:
      row.before_amount_paise === null ? null : BigInt(row.before_amount_paise),
    afterAmountPaise:
      row.after_amount_paise === null ? null : BigInt(row.after_amount_paise),
  };
}

// Shared by getActivityLogPage and getAllActivityLogRows (the export's own
// query, phase 12.4) -- every date-range/equality/search filter applies
// identically to both, only pagination differs. Generic over the exact
// PostgREST builder type rather than importing it by name, since both
// callers pass a differently-narrowed query at the call site (one with a
// cursor filter and a limit already applied, one without) and this only
// needs the four methods it actually calls.
function applyActivityLogFilters<
  T extends {
    eq: (column: string, value: string) => T;
    gte: (column: string, value: string) => T;
    lt: (column: string, value: string) => T;
    or: (filter: string) => T;
  },
>(query: T, filters: ActivityLogFilters): T {
  let next = query;

  // Day narrows the month, it doesn't replace it -- but a day already
  // clamped to fall inside the selected month (or with no month at all)
  // makes its own range a strict subset/equal, so applying just the day's
  // range when present is equivalent to applying both.
  const day = clampDayToMonth(filters.day, filters.month);
  if (day) {
    const { gte, lt } = dayRange(day);
    next = next.gte("occurred_at", gte).lt("occurred_at", lt);
  } else if (filters.month) {
    const { gte, lt } = monthRange(filters.month);
    next = next.gte("occurred_at", gte).lt("occurred_at", lt);
  }

  if (filters.branchId) {
    next = next.eq("branch_id", filters.branchId);
  }
  if (filters.actorId) {
    next = next.eq("actor_id", filters.actorId);
  }
  if (filters.action) {
    next = next.eq("action", filters.action);
  }
  if (filters.entity) {
    next = next.eq("entity", filters.entity);
  }
  if (filters.q) {
    // ilike, not full text search -- this table is low thousands of rows a
    // year (see the migration's own ponytail comment); a trigram index is
    // only worth adding if `explain analyze` says a sequential ilike scan
    // is actually slow at that volume, not on faith.
    const escaped = filters.q.replace(/[%_,()]/g, (char) => `\\${char}`);
    next = next.or(
      `actor_label.ilike.%${escaped}%,entity_label.ilike.%${escaped}%,summary.ilike.%${escaped}%`,
    );
  }

  return next;
}

export async function getActivityLogPage(
  supabase: SupabaseClient<Database>,
  params: { cursor?: string; filters?: ActivityLogFilters },
): Promise<ActivityLogPage> {
  const decoded = decodeActivityLogCursor(params.cursor);
  const filters = params.filters ?? {};
  const filtersActive = hasAnyFilter(filters);

  let query = supabase
    .from("activity_log")
    .select(ACTIVITY_LOG_SELECT)
    .neq("entity", REAL_ENTITY_FILTER)
    // occurred_at desc, id desc -- the only sort order this list has (see
    // CLAUDE.md's activity_log rule and the schema comment on
    // activity_log_occurred_at_id): occurred_at alone ties whenever one
    // transaction writes several rows (a cascade delete, an approval that
    // touches two tables), and id is the tiebreak that makes the order
    // deterministic instead of "whatever order Postgres feels like today."
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    // One extra row past the page size, never rendered -- its presence is
    // the only signal that there's a next page, without a separate count
    // query.
    .limit(ACTIVITY_LOG_PAGE_SIZE + 1);

  if (decoded) {
    // Keyset pagination: "everything strictly before this row in the sort
    // order" -- expressed as the two-branch OR a row-value comparison
    // `(occurred_at, id) < (cursor.occurred_at, cursor.id)` expands to,
    // since PostgREST's query-string filters have no row-constructor
    // syntax of their own.
    query = query.or(
      `occurred_at.lt.${decoded.occurredAt},and(occurred_at.eq.${decoded.occurredAt},id.lt.${decoded.id})`,
    );
  }

  query = applyActivityLogFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw new Error("Could not load the activity log.");
  }

  const hasMore = data.length > ACTIVITY_LOG_PAGE_SIZE;
  const pageRows = hasMore ? data.slice(0, ACTIVITY_LOG_PAGE_SIZE) : data;

  const rows: ActivityLogRow[] = pageRows.map(mapActivityLogRow);

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeActivityLogCursor({ occurredAt: lastRow.occurred_at, id: lastRow.id })
      : null;

  // The two empty states read as different sentences ("No activity
  // recorded yet" vs. "No activity matches these filters") and the code
  // must not be able to confuse them -- decided from filter presence
  // alone, in this one place, not re-derived per caller.
  let seededAt: string | null = null;
  if (rows.length === 0 && !decoded && !filtersActive) {
    const { data: seed } = await supabase
      .from("activity_log")
      .select("occurred_at")
      .eq("entity", REAL_ENTITY_FILTER)
      .order("occurred_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    seededAt = seed?.occurred_at ?? null;
  }

  return { rows, nextCursor, seededAt, filtersActive };
}

// For the export (phase 12.4), not the page -- an export needs every
// matching row, not one page of them, so this skips the cursor/limit
// machinery in getActivityLogPage entirely rather than looping it. Mirrors
// the existing split elsewhere in this codebase (getFeeAccountRecordsForExport
// vs. the dashboard's own paginated query, getAllExpenses vs.
// getExpenseDirectory) -- a dedicated "get everything for export" function
// is this app's actual convention, not a second page-fetching loop.
export async function getAllActivityLogRows(
  supabase: SupabaseClient<Database>,
  filters: ActivityLogFilters,
): Promise<ActivityLogRow[]> {
  let query = supabase
    .from("activity_log")
    .select(ACTIVITY_LOG_SELECT)
    .neq("entity", REAL_ENTITY_FILTER)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });

  query = applyActivityLogFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    throw new Error("Could not load the activity log.");
  }

  return data.map(mapActivityLogRow);
}

export interface ActivityLogActorOption {
  id: string;
  fullName: string;
  isActive: boolean;
}

// Includes a deactivated teacher/admin -- their past actions still belong
// in the log and still need a name to filter by, per CLAUDE.md's
// actor_label being a snapshot for exactly this reason.
export async function getActivityLogActorOptions(
  supabase: SupabaseClient<Database>,
): Promise<ActivityLogActorOption[]> {
  const { data, error } = await supabase
    .from("profile")
    .select("id, full_name, is_active")
    .order("full_name");

  if (error) {
    throw new Error("Could not load the list of people to filter by.");
  }

  return data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    isActive: row.is_active,
  }));
}
