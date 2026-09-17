import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getPendingClaims } from "@/lib/claims/queries";
import { ClaimRow } from "@/components/claims/claim-row";

export const metadata: Metadata = {
  title: "To verify",
};

export default async function VerifyPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const claims = await getPendingClaims(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium text-ink">To verify</h1>

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
  );
}
