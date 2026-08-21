"use client";

import { useActionState } from "react";
import { Field, inputClassName } from "@/components/forms/field";
import {
  createStudentWithFeeAccount,
  type ActionState,
} from "@/lib/records/actions";
import type { ServiceType } from "@/lib/records/types";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";
import { CLASS_SECTIONS } from "@/lib/records/class-sections";

const initialState: ActionState = { error: null };

interface AddStudentFormProps {
  serviceType: ServiceType;
  branches: BranchOption[];
  academicYearId: string;
}

export function AddStudentForm({
  serviceType,
  branches,
  academicYearId,
}: AddStudentFormProps) {
  const [state, formAction, isPending] = useActionState(
    createStudentWithFeeAccount,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="serviceType" value={serviceType} />
      <input type="hidden" name="academicYearId" value={academicYearId} />

      <Field label="Branch">
        <select name="branchId" required className={inputClassName}>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Admission number">
        <input name="admissionNo" required className={inputClassName} />
      </Field>

      <Field label="Student full name">
        <input name="fullName" required className={inputClassName} />
      </Field>

      <Field label="Guardian name">
        <input name="guardianName" required className={inputClassName} />
      </Field>

      <Field label="Phone">
        <input name="phone" required className={inputClassName} />
      </Field>

      <Field label="Grade">
        <select name="classSection" required className={inputClassName}>
          <option value="">Choose a grade</option>
          {CLASS_SECTIONS.map((classSection) => (
            <option key={classSection} value={classSection}>
              {classSection}
            </option>
          ))}
        </select>
      </Field>

      {serviceType === "transport" ? (
        <Field label="Pickup point">
          <input name="pickupPoint" required className={inputClassName} />
        </Field>
      ) : (
        <Field label="Slot">
          <input name="slot" required className={inputClassName} />
        </Field>
      )}

      <Field label="Total receivable (₹)">
        <input
          name="totalReceivable"
          type="number"
          min="0"
          step="1"
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Due date">
        <input name="dueDate" type="date" required className={inputClassName} />
      </Field>

      <Field label="Starts on">
        <input
          name="startsOn"
          type="date"
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Ends on">
        <input name="endsOn" type="date" required className={inputClassName} />
      </Field>

      {state.error ? (
        <p className="text-xs text-attention" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-md bg-accent text-sm font-medium text-surface transition-colors duration-150 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Add student"}
      </button>
    </form>
  );
}
