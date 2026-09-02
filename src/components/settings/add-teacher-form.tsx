"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { createTeacher, type ActionState } from "@/lib/settings/actions";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";

const initialState: ActionState = { error: null };

export function AddTeacherForm({ branches }: { branches: BranchOption[] }) {
  const [state, formAction, isPending] = useActionState(
    createTeacher,
    initialState,
  );
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-3 border-t border-hairline pt-4"
    >
      <Field label="Teacher name" error={state.fieldErrors?.fullName}>
        <input name="fullName" required className={inputClassName} />
      </Field>

      <Field label="Username" error={state.fieldErrors?.username}>
        <input
          name="username"
          required
          placeholder="kavya"
          className={inputClassName}
        />
      </Field>

      <Field label="Password" error={state.fieldErrors?.password}>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          className={inputClassName}
        />
      </Field>

      <Field label="Branch" error={state.fieldErrors?.branchId}>
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

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClassName}
      >
        {isPending ? "Creating…" : "Create teacher login"}
      </button>
    </form>
  );
}
