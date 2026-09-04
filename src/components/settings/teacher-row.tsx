"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
  dangerButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import {
  deactivateTeacher,
  deleteTeacherPermanently,
  reactivateTeacher,
  updateTeacher,
  type ActionState,
} from "@/lib/settings/actions";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";
import type { TeacherRow as TeacherRowData } from "@/lib/settings/queries";

const initialState: ActionState = { error: null };

export function TeacherRow({
  teacher,
  branches,
}: {
  teacher: TeacherRowData;
  branches: BranchOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);
  const [branchId, setBranchId] = useState(
    branches.find((b) => b.code === teacher.branchCode)?.id ??
      branches[0]?.id ??
      "",
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateTeacher,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deactivateTeacher,
    initialState,
  );
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(
    reactivateTeacher,
    initialState,
  );
  const [permanentDeleteState, permanentDeleteAction, permanentDeletePending] =
    useActionState(deleteTeacherPermanently, initialState);

  // useActionState's initial value and a successful action's return are
  // both { error: null } by shape, but different object references -- that
  // reference inequality is what distinguishes "never submitted" from "just
  // saved successfully", since ActionState carries no explicit success flag.
  useEffect(() => {
    if (updateState !== initialState && !updateState.error) {
      setEditing(false);
    }
  }, [updateState]);

  // Same trick for the confirm step: a successful deactivation used to be
  // masked by the row disappearing once revalidation removed it (this was
  // a genuine hard delete before). Now the row stays -- just marked
  // Inactive -- so without this it would sit stuck showing Confirm/Cancel
  // forever after a successful click.
  useEffect(() => {
    if (deleteState !== initialState && !deleteState.error) {
      setDeleting(false);
    }
  }, [deleteState]);

  // Same trick again for the reverse flow -- once reactivation succeeds,
  // teacher.isActive flips to true on the next render and this row falls
  // through to the normal Edit/Delete branch below on its own; this just
  // makes sure it doesn't stay stuck on Confirm/Cancel in the meantime.
  useEffect(() => {
    if (reactivateState !== initialState && !reactivateState.error) {
      setReactivating(false);
    }
  }, [reactivateState]);

  if (editing) {
    return (
      <li className="py-3">
        <form action={updateAction} noValidate className="flex flex-col gap-3">
          <input type="hidden" name="teacherId" value={teacher.id} />

          <Field label="Teacher name" error={updateState.fieldErrors?.fullName}>
            <input
              name="fullName"
              required
              defaultValue={teacher.fullName}
              className={inputClassName}
            />
          </Field>

          <Field label="Username" error={updateState.fieldErrors?.username}>
            <input
              name="username"
              required
              defaultValue={teacher.username}
              className={inputClassName}
            />
          </Field>

          <Field
            label="New password (optional)"
            error={updateState.fieldErrors?.newPassword}
          >
            <input
              name="newPassword"
              type="password"
              minLength={6}
              placeholder="Leave blank to keep the current password"
              className={inputClassName}
            />
          </Field>

          <Field label="Branch" error={updateState.fieldErrors?.branchId}>
            <Select
              name="branchId"
              ariaLabel="Branch"
              value={branchId}
              onChange={setBranchId}
              options={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
            />
          </Field>

          <FormError error={updateState.error} />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updatePending}
              className={`${primaryButtonClassName} h-8 px-3 text-xs`}
            >
              {updatePending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between py-2 text-sm">
      <div className="flex flex-col">
        <span className="text-ink">{teacher.fullName}</span>
        <span className="text-2xs text-ink-muted">
          {teacher.username} · {teacher.branchName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {teacher.isActive ? null : (
          <span className="rounded-md bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Inactive
          </span>
        )}
        {!teacher.isActive ? (
          reactivating ? (
            <form action={reactivateAction} className="flex items-center gap-2">
              <input type="hidden" name="teacherId" value={teacher.id} />
              <span className="max-w-[200px] text-2xs text-ink-secondary">
                They&apos;ll be able to sign in again.
              </span>
              <button
                type="submit"
                disabled={reactivatePending}
                className={`${primaryButtonClassName} h-7 shrink-0 px-2 text-2xs`}
              >
                {reactivatePending ? "Activating…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setReactivating(false)}
                className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                Cancel
              </button>
            </form>
          ) : permanentlyDeleting ? (
            <form
              action={permanentDeleteAction}
              className="flex items-center gap-2"
            >
              <input type="hidden" name="teacherId" value={teacher.id} />
              <span className="max-w-[220px] text-2xs text-ink-secondary">
                This permanently deletes their login and can&apos;t be undone.
                Only works if they&apos;ve never added anything.
              </span>
              <button
                type="submit"
                disabled={permanentDeletePending}
                className={`${dangerButtonClassName} h-7 shrink-0 px-2 text-2xs`}
              >
                {permanentDeletePending ? "Deleting…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setPermanentlyDeleting(false)}
                className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setReactivating(true)}
                className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                Activate
              </button>
              <button
                type="button"
                onClick={() => setPermanentlyDeleting(true)}
                className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
              >
                Delete
              </button>
            </>
          )
        ) : deleting ? (
          <form action={deleteAction} className="flex items-center gap-2">
            <input type="hidden" name="teacherId" value={teacher.id} />
            <span className="max-w-[220px] text-2xs text-ink-secondary">
              They won&apos;t be able to sign in again. Students, expenses, and
              approvals they&apos;ve added stay on record.
            </span>
            <button
              type="submit"
              disabled={deletePending}
              className={`${dangerButtonClassName} h-7 shrink-0 px-2 text-2xs`}
            >
              {deletePending ? "Removing…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setDeleting(false)}
              className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="h-7 rounded-md border border-border px-2 text-2xs text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
            >
              Delete
            </button>
          </>
        )}
      </div>
      <FormError error={deleteState.error} className="mt-1 w-full" />
      <FormError error={reactivateState.error} className="mt-1 w-full" />
      <FormError error={permanentDeleteState.error} className="mt-1 w-full" />
    </li>
  );
}
