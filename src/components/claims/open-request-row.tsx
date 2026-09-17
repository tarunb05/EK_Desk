"use client";

import { useState, useTransition } from "react";
import { cancelPaymentRequest } from "@/lib/payments/actions";
import { Countdown } from "@/components/shell/countdown";
import { FormError, dangerButtonClassName } from "@/components/forms/field";
import { formatLogDate } from "@/lib/domain/datetime";
import type { OpenRequest } from "@/lib/claims/queries";

export function OpenRequestRow({ request }: { request: OpenRequest }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelPaymentRequest(request.id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm text-ink">
          {request.studentName} — {request.branchName} · {request.serviceLabel}
        </p>
        <p className="mt-1 text-xs text-ink-secondary">
          {request.amountDisplay} · Ref {request.referenceCode} · Created{" "}
          {formatLogDate(request.createdAt)}
        </p>
        <div className="mt-1">
          <Countdown expiresAt={request.expiresAt} />
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-secondary">Cancel this request?</span>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className={`${dangerButtonClassName} h-8 px-3 text-xs`}
            >
              {isPending ? "Cancelling…" : "Confirm cancel"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Back
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Cancel
          </button>
        )}
        <FormError error={error} size="2xs" />
      </div>
    </div>
  );
}
