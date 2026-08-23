"use client";

import { useActionState, useState } from "react";
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
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
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [classSection, setClassSection] = useState("");

  if (state.submitted) {
    return (
      <p className="text-sm text-ink">
        Submitted for approval. An admin will review this student before
        they&apos;re added.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="serviceType" value={serviceType} />
      <input type="hidden" name="academicYearId" value={academicYearId} />

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

      <Field label="Admission number" error={state.fieldErrors?.admissionNo}>
        <input name="admissionNo" required className={inputClassName} />
      </Field>

      <Field label="Student full name" error={state.fieldErrors?.fullName}>
        <input name="fullName" required className={inputClassName} />
      </Field>

      <Field label="Guardian name" error={state.fieldErrors?.guardianName}>
        <input name="guardianName" required className={inputClassName} />
      </Field>

      <Field label="Phone" error={state.fieldErrors?.phone}>
        <input name="phone" required className={inputClassName} />
      </Field>

      <Field label="Grade" error={state.fieldErrors?.classSection}>
        <Select
          name="classSection"
          ariaLabel="Grade"
          value={classSection}
          onChange={setClassSection}
          options={[
            { value: "", label: "Choose a grade" },
            ...CLASS_SECTIONS.map((section) => ({
              value: section,
              label: section,
            })),
          ]}
        />
      </Field>

      {serviceType === "transport" ? (
        <Field label="Pickup point" error={state.fieldErrors?.pickupPoint}>
          <input name="pickupPoint" required className={inputClassName} />
        </Field>
      ) : (
        <Field label="Slot" error={state.fieldErrors?.slot}>
          <input name="slot" required className={inputClassName} />
        </Field>
      )}

      <Field
        label="Total receivable (₹)"
        error={state.fieldErrors?.totalReceivable}
      >
        <input
          name="totalReceivable"
          type="number"
          min="0"
          step="1"
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Due date" error={state.fieldErrors?.dueDate}>
        <input name="dueDate" type="date" required className={inputClassName} />
      </Field>

      <Field label="Starts on" error={state.fieldErrors?.startsOn}>
        <input
          name="startsOn"
          type="date"
          required
          className={inputClassName}
        />
      </Field>

      <Field label="Ends on" error={state.fieldErrors?.endsOn}>
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
        className={primaryButtonClassName}
      >
        {isPending ? "Saving…" : "Add student"}
      </button>
    </form>
  );
}
