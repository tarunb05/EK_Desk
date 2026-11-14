"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Field,
  FormError,
  dangerButtonClassName,
  inputClassName,
} from "@/components/forms/field";
import { maskAccountNumber } from "@/lib/domain/mask-account-number";
import {
  deleteCollectionAccount,
  setDefaultCollectionAccount,
  type CollectionAccountActionState,
  type DeleteCollectionAccountState,
} from "@/lib/settings/collection-account-actions";
import type { CollectionAccountRow as CollectionAccountRowData } from "@/lib/settings/queries";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";
import { CollectionAccountForm } from "@/components/settings/collection-account-form";

const initialState: CollectionAccountActionState = { error: null };
const initialDeleteState: DeleteCollectionAccountState = { error: null };

const SERVICE_LABEL: Record<string, string> = {
  transport: "Transport",
  daycare: "Daycare",
};

const smallButtonClassName =
  "h-7 rounded-full border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink";

// Delete, in place of the row: what will happen, the password, confirm.
// An account no payment request has used is removed; one that has been used
// is kept for those requests and hidden (delete_collection_account decides,
// since only it can see every request). Afterwards the row says which, and
// lists any student whose open pay link was cancelled, until Done refreshes
// the list.
function DeleteCollectionAccount({
  account,
  onCancel,
}: {
  account: CollectionAccountRowData;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    deleteCollectionAccount,
    initialDeleteState,
  );

  if (state.done) {
    return (
      <li className="flex flex-col gap-2 py-3 text-sm">
        <p className="text-ink">
          {state.done.removed
            ? `“${account.label}” is deleted.`
            : `“${account.label}” is deleted. Past payment requests sent with it still show its details.`}
        </p>
        {state.done.affected.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-md border border-attention bg-attention-fill/20 p-3">
            <p className="text-ink">
              These open payment links used this account, so they were
              cancelled. Send each student a new one.
            </p>
            <ul className="flex flex-col gap-1 text-2xs text-ink-secondary">
              {state.done.affected.map((item) => (
                <li key={`${item.admissionNo}-${item.serviceType}`}>
                  {item.studentName} ({item.admissionNo}):{" "}
                  {SERVICE_LABEL[item.serviceType] ?? item.serviceType}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className={smallButtonClassName}
          >
            Done
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3">
      <form
        action={action}
        className="flex flex-col gap-3 rounded-lg border border-attention/40 bg-surface p-4 text-sm"
      >
        <input type="hidden" name="accountId" value={account.id} />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-ink">Delete “{account.label}”?</p>
          <p className="text-ink-secondary">
            It stops being offered for new payment requests
            {account.isDefault
              ? ", and this branch will have no default account until you set one"
              : ""}
            . Any open payment link sent with it is cancelled. If it has been
            used before, those past requests keep its details.
          </p>
        </div>
        <Field
          label="Your password (to confirm deleting)"
          error={state.fieldErrors?.currentPassword}
        >
          <input
            name="currentPassword"
            type="password"
            required
            autoFocus
            className={inputClassName}
          />
        </Field>
        <FormError error={state.error} />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className={`${dangerButtonClassName} px-4`}
          >
            {pending ? "Deleting…" : "Delete account"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-10 rounded-full border border-border px-4 text-sm text-ink-secondary transition-colors hover:bg-surface-accent hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

export function CollectionAccountRow({
  account,
  branches,
}: {
  account: CollectionAccountRowData;
  branches: BranchOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [defaultState, defaultAction, defaultPending] = useActionState(
    setDefaultCollectionAccount,
    initialState,
  );

  if (deleting) {
    return (
      <DeleteCollectionAccount
        account={account}
        onCancel={() => setDeleting(false)}
      />
    );
  }

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
              <span className="rounded-full bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-accent">
                Default
              </span>
            ) : null}
            {account.isActive ? null : (
              <span className="rounded-full bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
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
                className="h-7 rounded-full border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                {defaultPending ? "Setting…" : "Set as default"}
              </button>
            </form>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-7 rounded-full border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="h-7 rounded-full border border-border px-2 text-2xs text-attention transition-colors duration-150 hover:border-attention hover:bg-attention-fill/30"
          >
            Delete
          </button>
        </div>
      </div>
      <FormError error={defaultState.error} />
    </li>
  );
}
