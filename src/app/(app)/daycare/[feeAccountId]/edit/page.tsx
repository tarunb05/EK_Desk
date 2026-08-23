import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFeeAccountRecordById } from "@/lib/records/queries";
import { EditFeeAccountForm } from "@/components/records/edit-fee-account-form";
import { BackLink } from "@/components/shell/back-link";

export default async function EditFeeAccountPage({
  params,
}: {
  params: Promise<{ feeAccountId: string }>;
}) {
  const { feeAccountId } = await params;
  const supabase = await createClient();
  const record = await getFeeAccountRecordById(supabase, feeAccountId);

  if (!record) {
    notFound();
  }

  return (
    <div className="max-w-xl">
      <BackLink href="/students" label="Return to student page" />
      <h1 className="mb-1 text-xl font-medium text-ink">Edit fee account</h1>
      <p className="mb-4 text-sm text-ink-secondary">
        {record.studentFullName}
      </p>
      <EditFeeAccountForm record={record} />
    </div>
  );
}
