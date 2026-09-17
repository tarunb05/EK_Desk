import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getOpenRequests, getPendingClaims } from "@/lib/claims/queries";
import { ClaimRow } from "@/components/claims/claim-row";
import { OpenRequestRow } from "@/components/claims/open-request-row";

export const metadata: Metadata = {
  title: "Payment verification",
};

export default async function VerifyPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [claims, openRequests] = await Promise.all([
    getPendingClaims(supabase),
    getOpenRequests(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-medium text-ink">Payment verification</h1>

      <div className="flex flex-col gap-3">
        <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Claims to review
        </h2>
        {claims.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            Nothing waiting for review — payment claims from parents or entered
            from WhatsApp will show up here until you confirm or reject them.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
          Open requests
        </h2>
        {openRequests.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            Nothing open — requests waiting for a parent to pay or report a
            payment will show up here.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {openRequests.map((request) => (
              <OpenRequestRow key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
