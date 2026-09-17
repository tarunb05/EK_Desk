"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/forms/field";
import { maskAccountNumber } from "@/lib/domain/mask-account-number";
import {
  setDefaultCollectionAccount,
  type CollectionAccountActionState,
} from "@/lib/settings/collection-account-actions";
import type { CollectionAccountRow as CollectionAccountRowData } from "@/lib/settings/queries";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";
import { CollectionAccountForm } from "@/components/settings/collection-account-form";

const initialState: CollectionAccountActionState = { error: null };

export function CollectionAccountRow({
  account,
  branches,
}: {
  account: CollectionAccountRowData;
  branches: BranchOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [defaultState, defaultAction, defaultPending] = useActionState(
    setDefaultCollectionAccount,
    initialState,
  );

  if (editing) {
    return (
      <li className="py-3">
        <CollectionAccountForm
          branches={branches}
          account={account}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-ink">
            {account.label}
            {account.isDefault ? (
              <span className="rounded-md bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-accent">
                Default
              </span>
            ) : null}
            {account.isActive ? null : (
              <span className="rounded-md bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Inactive
              </span>
            )}
          </span>
          <span className="text-2xs text-ink-muted">
            {account.branchName}
            {account.upiId ? ` · ${account.upiId}` : ""}
            {account.accountNumber
              ? ` · ${maskAccountNumber(account.accountNumber)}`
              : ""}
          </span>
          {account.lastChangedAt ? (
            <span className="text-2xs text-ink-muted">
              Changed by {account.lastChangedBy ?? "someone"} on{" "}
              {new Date(account.lastChangedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!account.isDefault ? (
            <form action={defaultAction}>
              <input type="hidden" name="accountId" value={account.id} />
              <button
                type="submit"
                disabled={defaultPending}
                className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                {defaultPending ? "Setting…" : "Set as default"}
              </button>
            </form>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Edit
          </button>
        </div>
      </div>
      <FormError error={defaultState.error} />
    </li>
  );
}
