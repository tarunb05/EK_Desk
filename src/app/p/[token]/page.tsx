import type { Metadata } from "next";
import { getPayPageData } from "@/lib/payments/actions";
import { renderQrSvg } from "@/lib/payments/qr";
import { ClaimForm } from "@/components/pay/claim-form";

// Never indexed -- this is a bearer-token URL, not content meant to be
// found. Cache-Control/Referrer-Policy for this route are set in
// next.config.ts instead, since those need to be real response headers,
// not something the metadata API can express.
export const metadata: Metadata = {
  title: "Pay your fee",
  robots: { index: false, follow: false },
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPayPageData(token);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <p className="max-w-sm text-center text-sm text-ink-secondary">
          This payment link is no longer active. Please contact the school
          office.
        </p>
      </main>
    );
  }

  const qrSvg = data.upiUri ? await renderQrSvg(data.upiUri) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 bg-canvas px-4 py-8">
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          {data.branchName} · {data.serviceLabel} fee
        </p>
        <p className="mt-1 text-sm text-ink-secondary">For: {data.childFirstName}</p>
        <p className="mt-3 text-2xl font-medium text-ink">{data.amountDisplay}</p>
        <p className="mt-1 text-xs text-ink-muted">
          Pay by {data.expiresAtDisplay} · Reference {data.referenceCode}
        </p>
      </div>

      {data.includeUpi && data.upiId ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-surface p-4">
          <p className="text-sm text-ink-secondary">
            Pay by UPI: <span className="text-ink">{data.upiId}</span>
          </p>
          <p className="text-xs text-ink-muted">Payee name shown: {data.payeeName}</p>
          {qrSvg ? (
            <div
              className="h-48 w-48"
              // Server-generated SVG from a fixed upi://pay URI this same
              // request built -- not user input, safe to inline.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : null}
          <a
            href={data.upiUri ?? undefined}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-surface"
          >
            Pay with UPI app
          </a>
          <p className="text-2xs text-ink-muted">
            If the button doesn&apos;t work, scan the QR or pay to the UPI ID
            above.
          </p>
        </div>
      ) : null}

      {data.includeBank && data.accountHolder ? (
        <div className="rounded-md border border-border bg-surface p-4 text-sm text-ink-secondary">
          <p className="font-medium text-ink">Bank transfer</p>
          <p className="mt-1">
            {data.accountHolder}, {data.bankName}
          </p>
          <p>
            A/c {data.accountNumber}, IFSC {data.ifsc}
          </p>
        </div>
      ) : null}

      <ClaimForm token={token} />

      <p className="text-2xs text-ink-muted">
        After paying, tap &quot;I&apos;ve paid&quot; above, or reply on
        WhatsApp with the UTR number. The school will never ask for your UPI
        PIN, OTP, or card details.
      </p>
    </main>
  );
}
