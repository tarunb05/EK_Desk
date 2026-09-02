import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultRouteFor, type Role } from "@/lib/auth/routes";

export interface AuthedProfile {
  userId: string;
  role: Role;
  branchId: string | null;
}

// The one sanctioned way anything resolves "who is this and what can they
// do" -- goes through the auth_role()/auth_branch_id() RPCs (security
// definer functions reading `profile`, see the role-based-rls migration)
// rather than selecting from `profile` directly, since a non-admin has no
// RLS grant to read profile rows at all, including their own. Both RPCs
// already return nothing for a deactivated user, so there's no separate
// is_active check needed here.
export async function requireAuth(): Promise<AuthedProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: role } = await supabase.rpc("auth_role");

  if (!role) {
    redirect("/login");
  }

  const { data: branchId } = await supabase.rpc("auth_branch_id");

  return { userId: user.id, role: role as Role, branchId: branchId ?? null };
}

export async function requireRole(role: Role): Promise<AuthedProfile> {
  const authed = await requireAuth();

  if (authed.role !== role) {
    redirect(defaultRouteFor(authed.role));
  }

  return authed;
}
