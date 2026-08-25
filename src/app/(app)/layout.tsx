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
  // Both roles reach /approvals now -- admin sees everyone's pending count,
  // a teacher sees only their own (RLS scopes the underlying query to
  // `submitted_by = auth.uid()` automatically, no role branch needed here).
  const pendingApprovalsCount = await getPendingSubmissionCount(supabase);

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
