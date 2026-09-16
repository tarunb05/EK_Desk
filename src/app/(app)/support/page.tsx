import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-role";
import { getSupportRequests } from "@/lib/support/queries";
import { SupportRequestRow } from "@/components/support/support-request-row";

// Static rather than branched on role, same call this page's sibling
// (/approvals) makes -- not worth a second requireAuth() round trip just
// for the browser tab title.
export const metadata: Metadata = {
  title: "Support",
};

export default async function SupportPage() {
  // Same route for both roles -- RLS scopes what getSupportRequests can
  // actually return (a teacher's "teacher reads own requests" policy
  // limits it to submitted_by = auth.uid()), so there's no separate query
  // path for "my requests" vs. the full inbox, only different page copy
  // and whether SupportRequestRow shows who/which branch sent it and the
  // resolve control.
  const { role } = await requireAuth();
  const supabase = await createClient();
  const requests = await getSupportRequests(supabase);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-medium text-ink">
          {role === "admin" ? "Support requests" : "Support"}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {role === "admin"
            ? "Messages teachers have sent asking for help."
            : "Use the Support button in the top bar to reach an admin. Anything you've sent shows up here."}
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          {role === "admin"
            ? "Nothing here — a teacher's support requests will show up here."
            : "Nothing sent yet."}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-surface">
          {requests.map((request) => (
            <SupportRequestRow
              key={request.id}
              request={request}
              showAdminDetails={role === "admin"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
