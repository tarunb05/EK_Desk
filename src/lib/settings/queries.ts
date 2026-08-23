import type { createAdminClient } from "@/lib/supabase/admin";
import { internalEmailToUsername } from "@/lib/auth/username";

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
