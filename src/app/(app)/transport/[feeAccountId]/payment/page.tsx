import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFeeAccountRecordById } from "@/lib/records/queries";
import { formatPaise } from "@/lib/domain/money";
import { RecordPaymentForm } from "@/components/records/record-payment-form";
import { BackLink } from "@/components/shell/back-link";

export const metadata: Metadata = {
  title: "Record Payment",
};

export default async function RecordPaymentPage({
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
      <h1 className="mb-1 text-xl font-medium text-ink">Record payment</h1>
      <p className="mb-4 text-sm text-ink-secondary">
        {record.studentFullName} — pending {formatPaise(record.pendingPaise)}
      </p>
      <RecordPaymentForm feeAccountId={record.feeAccountId} />
    </div>
  );
}
