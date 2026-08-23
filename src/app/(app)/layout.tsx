import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { SidebarProvider } from "@/components/shell/sidebar-context";
import { RouteRestrictedBanner } from "@/components/shell/route-restricted-banner";
import { createClient } from "@/lib/supabase/server";
import { internalEmailToUsername } from "@/lib/auth/username";
import { requireAuth } from "@/lib/auth/require-role";
import { getPendingSubmissionCount } from "@/lib/records/approvals";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already redirects anything unauthenticated or roleless to
  // /login before a request reaches here — this resolves the role this
  // render needs (for the nav), not a second access-control gate.
  const { role } = await requireAuth();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const username = user?.email ? internalEmailToUsername(user.email) : null;
  // Only an admin can reach /approvals at all, and only an admin's RLS
  // policies actually return a nonzero count here anyway -- skip the query
  // for a teacher entirely.
  const pendingApprovalsCount =
    role === "admin" ? await getPendingSubmissionCount(supabase) : 0;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-canvas">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-surface"
        >
          Skip to content
        </a>
        <Sidebar role={role} pendingApprovalsCount={pendingApprovalsCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar username={username} />
          <RouteRestrictedBanner />
          <main
            id="main-content"
            className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 md:px-6 md:py-6"
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
