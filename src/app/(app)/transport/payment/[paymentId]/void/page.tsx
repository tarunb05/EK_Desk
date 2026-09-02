import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/domain/money";
import { VoidPaymentForm } from "@/components/records/void-payment-form";
import { BackLink } from "@/components/shell/back-link";

export const metadata: Metadata = {
  title: "Void Payment",
};

export default async function VoidPaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from("payment")
    .select("id, amount_paise, paid_on, voided_at")
    .eq("id", paymentId)
    .single();

  if (error || !payment || payment.voided_at) {
    notFound();
  }

  return (
    <div className="max-w-xl">
      <BackLink href="/transport" />
      <h1 className="mb-1 text-xl font-medium text-ink">Void payment</h1>
      <p className="mb-4 text-sm text-ink-secondary">
        {formatPaise(BigInt(payment.amount_paise))} paid on {payment.paid_on}
      </p>
      <VoidPaymentForm paymentId={payment.id} />
    </div>
  );
}
