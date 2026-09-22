import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { SidebarProvider } from "@/components/shell/sidebar-context";
import { RouteRestrictedBanner } from "@/components/shell/route-restricted-banner";
import { ToastProvider } from "@/components/shell/toast-context";
import { ToastNoticeReader } from "@/components/shell/toast-notice-reader";
import { createClient } from "@/lib/supabase/server";
import { internalEmailToUsername } from "@/lib/auth/username";
import { requireAuth } from "@/lib/auth/require-role";
import { getPendingSubmissionCount } from "@/lib/records/approvals";
import { getOpenSupportRequestCount } from "@/lib/support/queries";
import { getPendingClaimsCount } from "@/lib/claims/queries";

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
  // getPendingClaimsCount always returns 0 for a teacher session -- RLS
  // has no teacher policy on payment_claim at all (Phase 15.1) -- so this
  // is safe to fetch unconditionally, same as the two counts above.
  const [pendingApprovalsCount, openSupportCount, pendingClaimsCount] =
    await Promise.all([
      getPendingSubmissionCount(supabase),
      getOpenSupportRequestCount(supabase),
      getPendingClaimsCount(supabase),
    ]);

  return (
    <SidebarProvider>
      <ToastProvider>
        <ToastNoticeReader />
        <div className="flex min-h-screen bg-canvas">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-surface"
          >
            Skip to content
          </a>
          <Sidebar
            role={role}
            pendingApprovalsCount={pendingApprovalsCount}
            openSupportCount={openSupportCount}
            pendingClaimsCount={pendingClaimsCount}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar username={username} role={role} />
            <RouteRestrictedBanner />
            <main
              id="main-content"
              // pb well beyond py-4/py-6 -- a DateField's calendar popover
              // (~340px tall) opens below its trigger button (date-field.tsx),
              // and a date field near the bottom of a form (Ends on, the
              // last field on Add student) had nowhere to render: the page
              // ended right at the button, so the popover was clipped, and
              // dragging the scrollbar to see the rest fired a mousedown
              // outside the popover's own container, which its outside-click
              // handler treated as "closed it". Extra room below every
              // page's content means that popover almost always fits without
              // needing to scroll into it at all.
              className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 pb-64 md:px-6 md:py-6 md:pb-64"
            >
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </SidebarProvider>
  );
}
