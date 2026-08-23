import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getPendingSubmissions } from "@/lib/records/approvals";
import { ApprovalRow } from "@/components/records/approval-row";

export default async function ApprovalsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const submissions = await getPendingSubmissions(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium text-ink">Approvals</h1>

      {submissions.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          Nothing waiting for review — teacher submissions will show up here.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-surface">
          {submissions.map((submission) => (
            <ApprovalRow
              key={`${submission.table}-${submission.id}`}
              submission={submission}
            />
          ))}
        </div>
      )}
    </div>
  );
}
