"use client";

import { useActionState } from "react";
import {
  resolveSupportRequest,
  type SupportActionState,
} from "@/lib/support/actions";
import { FormError, primaryButtonClassName } from "@/components/forms/field";
import type { SupportRequestRow as SupportRequestRowData } from "@/lib/support/queries";

const initialState: SupportActionState = { error: null };

// showAdminDetails (not just "isAdmin") -- what actually differs per role
// is whether the submitter/branch and the resolve control render, and that
// stays true for an admin regardless of a given row's own status.
export function SupportRequestRow({
  request,
  showAdminDetails,
}: {
  request: SupportRequestRowData;
  showAdminDetails: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    resolveSupportRequest,
    initialState,
  );
  const isOpen = request.status === "open";

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showAdminDetails ? (
            <p className="text-sm text-ink">
              <span className="font-medium">{request.submittedByName}</span>
              <span className="text-ink-muted"> · {request.branchName}</span>
            </p>
          ) : null}
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
            {request.message}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`rounded-md px-2 py-0.5 text-2xs font-medium uppercase tracking-wide ${
              isOpen
                ? "bg-attention-fill text-attention"
                : "bg-surface-accent text-ink-muted"
            }`}
          >
            {isOpen ? "Open" : "Resolved"}
          </span>
          <span className="text-2xs text-ink-muted">
            {request.createdAt.slice(0, 10)}
          </span>
        </div>
      </div>

      {showAdminDetails && isOpen ? (
        <div className="mt-3">
          <form action={formAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <button
              type="submit"
              disabled={isPending}
              className={`${primaryButtonClassName} h-8 px-3 text-xs`}
            >
              {isPending ? "Marking…" : "Mark resolved"}
            </button>
          </form>
          <FormError error={state.error} className="mt-2" />
        </div>
      ) : null}

      {!showAdminDetails && !isOpen ? (
        <p className="mt-2 text-2xs text-ink-muted">
          Resolved{request.resolvedAt ? ` on ${request.resolvedAt.slice(0, 10)}` : ""}.
        </p>
      ) : null}
    </div>
  );
}
