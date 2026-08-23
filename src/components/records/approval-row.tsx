"use client";

import { useActionState, useState } from "react";
import {
  approveSubmission,
  rejectSubmission,
  type ActionState,
} from "@/lib/records/actions";
import {
  inputClassName,
  primaryButtonClassName,
  dangerButtonClassName,
} from "@/components/forms/field";
import { ChevronDownIcon } from "@/components/shell/nav-icons";
import type { PendingSubmission } from "@/lib/records/approvals";

const initialState: ActionState = { error: null };

export function ApprovalRow({ submission }: { submission: PendingSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [approveState, approveAction, approvePending] = useActionState(
    approveSubmission,
    initialState,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectSubmission,
    initialState,
  );

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex items-center gap-1.5 text-sm text-ink hover:text-accent"
        >
          <ChevronDownIcon
            size={14}
            className={`text-ink-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {submission.summary}
        </button>
        <span className="text-2xs text-ink-muted">
          {submission.submittedAt.slice(0, 10)}
        </span>
      </div>

      {expanded ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {submission.detail.map((item) => (
            <div key={item.label} className="contents">
              <dt className="text-ink-muted">{item.label}</dt>
              <dd className="text-ink">{item.value || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={approveAction}>
          <input type="hidden" name="submissionTable" value={submission.table} />
          <input type="hidden" name="submissionId" value={submission.id} />
          <button
            type="submit"
            disabled={approvePending}
            className={`${primaryButtonClassName} h-8 px-3 text-xs`}
          >
            {approvePending ? "Approving…" : "Approve"}
          </button>
        </form>

        {rejecting ? (
          <form
            action={rejectAction}
            noValidate
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="hidden"
              name="submissionTable"
              value={submission.table}
            />
            <input type="hidden" name="submissionId" value={submission.id} />
            <input
              name="reviewNote"
              required
              placeholder="Reason for rejecting"
              className={`h-8 text-xs ${inputClassName}`}
            />
            <button
              type="submit"
              disabled={rejectPending}
              className={`${dangerButtonClassName} h-8 px-3 text-xs`}
            >
              {rejectPending ? "Rejecting…" : "Confirm reject"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Reject
          </button>
        )}
      </div>

      {approveState.error ? (
        <p className="mt-2 text-xs text-attention" role="alert">
          {approveState.error}
        </p>
      ) : null}
      {rejectState.error ? (
        <p className="mt-2 text-xs text-attention" role="alert">
          {rejectState.error}
        </p>
      ) : null}
    </div>
  );
}
