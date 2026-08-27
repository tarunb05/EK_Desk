import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-role";
import { getPendingSubmissions } from "@/lib/records/approvals";
import { ApprovalRow } from "@/components/records/approval-row";

// Static rather than "My requests" for a teacher (which the on-page <h1>
// does show) -- that distinction isn't worth a second requireAuth() round
// trip (getUser + two RPCs) just for the browser tab title.
export const metadata: Metadata = {
  title: "Approvals",
};

export default async function ApprovalsPage() {
  // Same route for both roles -- RLS scopes what getPendingSubmissions can
  // actually return (a teacher's "teacher reads own submissions" policy on
  // every submission table already limits it to submitted_by = auth.uid()),
  // so there's no separate query path needed for "my requests" vs. the
  // full review queue, only a different page title/empty-state copy and
  // whether ApprovalRow renders the approve/reject controls at all.
  const { role } = await requireAuth();
  const supabase = await createClient();
  const submissions = await getPendingSubmissions(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium text-ink">
        {role === "admin" ? "Approvals" : "My requests"}
      </h1>

      {submissions.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          {role === "admin"
            ? "Nothing waiting for review — teacher submissions will show up here."
            : "Nothing pending — anything you submit for approval will show up here until an admin reviews it."}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-surface">
          {submissions.map((submission) => (
            <ApprovalRow
              key={`${submission.table}-${submission.id}`}
              submission={submission}
              readOnly={role !== "admin"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
