import type { SupabaseClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import { internalEmailToUsername } from "@/lib/auth/username";
import type { Database } from "@/lib/supabase/database.types";

export interface TeacherRow {
  id: string;
  fullName: string;
  username: string;
  branchCode: string;
  branchName: string;
  isActive: boolean;
}

// Listing needs the admin client, not just an admin's own RLS-scoped
// session: profile has no read policy beyond "admin can select", which
// covers the profile rows themselves, but a username only exists as an
// auth.users email, and that table isn't reachable through PostgREST at
// all -- only the Admin API's listUsers() can resolve it.
export async function getTeachersWithBranch(
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<TeacherRow[]> {
  const [{ data: profiles }, { data: branches }, { data: usersList }] =
    await Promise.all([
      adminClient
        .from("profile")
        .select("id, full_name, branch_id, is_active")
        .eq("role", "teacher")
        .eq("is_hidden", false)
        .order("full_name"),
      adminClient.from("branch").select("id, code, name"),
      adminClient.auth.admin.listUsers(),
    ]);

  const branchById = new Map((branches ?? []).map((b) => [b.id, b]));
  const emailById = new Map(
    (usersList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  return (profiles ?? []).map((profile) => {
    const branch = profile.branch_id ? branchById.get(profile.branch_id) : undefined;
    return {
      id: profile.id,
      fullName: profile.full_name,
      username: internalEmailToUsername(emailById.get(profile.id) ?? ""),
      branchCode: branch?.code ?? "",
      branchName: branch?.name ?? "",
      isActive: profile.is_active,
    };
  });
}

export interface CollectionAccountRow {
  id: string;
  branchId: string;
  branchName: string;
  label: string;
  upiId: string | null;
  payeeName: string;
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  isDefault: boolean;
  isActive: boolean;
  lastChangedBy: string | null;
  lastChangedAt: string | null;
}

// The audit trail (collection_account_change_log) is written one row per
// save, not one row per account -- this picks the most recent row per
// account in JS rather than a dedicated "latest change" view, since the
// row counts here (a handful of accounts, a modest number of edits) don't
// justify one.
export async function getCollectionAccountsWithLatestChange(
  supabase: SupabaseClient<Database>,
): Promise<CollectionAccountRow[]> {
  const [{ data: accounts, error: accountsError }, { data: changes }] =
    await Promise.all([
      supabase
        .from("collection_account")
        .select("*, branch:branch_id (name)")
        .order("branch_id")
        .order("label"),
      supabase
        .from("collection_account_change_log")
        .select("collection_account_id, created_at, actor:actor (full_name)")
        .order("created_at", { ascending: false }),
    ]);

  if (accountsError || !accounts) {
    throw new Error("Could not load collection accounts.");
  }

  const latestChangeByAccount = new Map<
    string,
    { actorName: string | null; createdAt: string }
  >();
  for (const change of changes ?? []) {
    if (!latestChangeByAccount.has(change.collection_account_id)) {
      latestChangeByAccount.set(change.collection_account_id, {
        actorName: change.actor?.full_name ?? null,
        createdAt: change.created_at,
      });
    }
  }

  return accounts.map((account) => {
    const latest = latestChangeByAccount.get(account.id);
    return {
      id: account.id,
      branchId: account.branch_id,
      branchName: account.branch?.name ?? "",
      label: account.label,
      upiId: account.upi_id,
      payeeName: account.payee_name,
      bankName: account.bank_name,
      accountHolder: account.account_holder,
      accountNumber: account.account_number,
      ifsc: account.ifsc,
      isDefault: account.is_default,
      isActive: account.is_active,
      lastChangedBy: latest?.actorName ?? null,
      lastChangedAt: latest?.createdAt ?? null,
    };
  });
}

export interface ExpenseCategoryWithStats {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  expenseCount: number;
  totalSpentPaise: bigint;
}

export async function getExpenseCategoriesWithStats(
  supabase: SupabaseClient<Database>,
): Promise<ExpenseCategoryWithStats[]> {
  const { data, error } = await supabase
    .from("expense_category_summary")
    .select("*")
    .order("sort_order");

  if (error) {
    throw new Error("Could not load expense categories.");
  }

  // Every column on a Postgres view is typed nullable by the generator
  // regardless of the underlying table's own constraints (it can't prove
  // otherwise) -- id can't actually be null for a real row, so a row
  // without one isn't a category to render, just a generation artifact to
  // skip rather than something to force past the type system.
  return data
    .filter((row): row is typeof row & { id: string } => row.id !== null)
    .map((row) => ({
      id: row.id,
      name: row.name ?? "",
      isActive: row.is_active ?? false,
      sortOrder: row.sort_order ?? 0,
      expenseCount: row.expense_count ?? 0,
      totalSpentPaise: BigInt(row.total_spent_paise ?? 0),
    }));
}
