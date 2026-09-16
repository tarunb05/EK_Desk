import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface SupportRequestRow {
  id: string;
  message: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  branchName: string;
  // Only meaningful for the admin view -- a teacher's own requests (the
  // only rows RLS lets her read) are always hers, so the page doesn't
  // bother showing her her own name back to her.
  submittedByName: string | null;
}

// Same route serves both roles (see /support/page.tsx) -- RLS already
// scopes a teacher's read to "submitted_by = auth.uid()" (this migration's
// "teacher reads own requests" policy), so this one query works for either
// caller. The submitter-name substitution for a deactivated teacher
// mirrors approvals.ts and expense_record's profile_full_name().
export async function getSupportRequests(
  supabase: SupabaseClient<Database>,
): Promise<SupportRequestRow[]> {
  const { data: requests, error } = await supabase
    .from("support_request")
    .select("id, branch_id, submitted_by, message, status, created_at, resolved_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load support requests.");
  }

  const branchIds = Array.from(new Set(requests.map((r) => r.branch_id)));
  const submitterIds = Array.from(new Set(requests.map((r) => r.submitted_by)));

  const [{ data: branches }, { data: profiles }] = await Promise.all([
    branchIds.length > 0
      ? supabase.from("branch").select("id, name").in("id", branchIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    submitterIds.length > 0
      ? supabase
          .from("profile")
          .select("id, full_name, is_active")
          .in("id", submitterIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string; is_active: boolean }[],
        }),
  ]);

  const branchNameById = new Map((branches ?? []).map((b) => [b.id, b.name]));
  // A submitter deactivated since still owns every request they sent --
  // only the displayed name changes, same rule as expense_record and
  // approvals.ts.
  const submitterNameById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p.is_active ? p.full_name : "Teacher (Deleted)",
    ]),
  );

  return requests.map((row) => ({
    id: row.id,
    message: row.message,
    status: row.status as "open" | "resolved",
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    branchName: branchNameById.get(row.branch_id) ?? "",
    submittedByName: submitterNameById.get(row.submitted_by) ?? null,
  }));
}

export async function getOpenSupportRequestCount(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { count } = await supabase
    .from("support_request")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return count ?? 0;
}
