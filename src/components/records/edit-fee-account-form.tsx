"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { DateField } from "@/components/forms/date-field";
import { type ActionState, updateFeeAccount } from "@/lib/records/actions";
import { paiseToRupees } from "@/lib/domain/money";
import type { FeeAccountRecordRow } from "@/lib/records/types";
import { CLASS_SECTIONS } from "@/lib/records/class-sections";

const initialState: ActionState = { error: null };

export function EditFeeAccountForm({
  record,
}: {
  record: FeeAccountRecordRow;
}) {
  const [state, formAction, isPending] = useActionState(
    updateFeeAccount,
    initialState,
  );
  const [status, setStatus] = useState(record.status);
  const [classSection, setClassSection] = useState(record.classSection);

  if (state.submitted) {
    return (
      <p className="text-sm text-ink">
        Submitted for approval. An admin will review this change before it
        takes effect.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="feeAccountId" value={record.feeAccountId} />

      <Field
        label="Student full name"
        error={state.fieldErrors?.fullName}
      >
        <input
          name="fullName"
          required
          defaultValue={record.studentFullName}
          className={inputClassName}
        />
      </Field>

      <Field label="Guardian name" error={state.fieldErrors?.guardianName}>
        <input
          name="guardianName"
          required
          defaultValue={record.guardianName}
          className={inputClassName}
        />
      </Field>

      <Field label="Phone" error={state.fieldErrors?.phone}>
        <input
          name="phone"
          required
          defaultValue={record.phone}
          className={inputClassName}
        />
      </Field>

      <Field label="Grade" error={state.fieldErrors?.classSection}>
        <Select
          name="classSection"
          ariaLabel="Grade"
          value={classSection}
          onChange={setClassSection}
          options={CLASS_SECTIONS.map((section) => ({
            value: section,
            label: section,
          }))}
        />
      </Field>

      <Field label="Notes (optional)">
        <input
          name="notes"
          defaultValue={record.notes ?? ""}
          className={inputClassName}
        />
      </Field>

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
          defaultValue={paiseToRupees(record.totalReceivablePaise)}
          className={inputClassName}
        />
      </Field>

      <Field label="Due date" error={state.fieldErrors?.dueDate}>
        <DateField
          name="dueDate"
          required
          ariaLabel="Due date"
          defaultValue={record.dueDate}
        />
      </Field>

      <Field label="Starts on" error={state.fieldErrors?.startsOn}>
        <DateField
          name="startsOn"
          required
          ariaLabel="Starts on"
          defaultValue={record.startsOn}
        />
      </Field>

      <Field label="Ends on" error={state.fieldErrors?.endsOn}>
        <DateField
          name="endsOn"
          required
          ariaLabel="Ends on"
          defaultValue={record.endsOn}
        />
      </Field>

      <Field label="Status">
        <Select
          name="status"
          ariaLabel="Status"
          value={status}
          onChange={(next) => setStatus(next as typeof record.status)}
          options={[
            { value: "active", label: "Active" },
            { value: "discontinued", label: "Discontinued" },
          ]}
        />
      </Field>

      {record.serviceType === "transport" ? (
        <>
          <input
            type="hidden"
            name="routeName"
            value={record.routeName ?? ""}
          />
          <Field
            label="Pickup point"
            error={state.fieldErrors?.pickupPoint}
          >
            <input
              name="pickupPoint"
              required
              defaultValue={record.pickupPoint ?? ""}
              className={inputClassName}
            />
          </Field>
        </>
      ) : (
        <Field label="Slot" error={state.fieldErrors?.slot}>
          <input
            name="slot"
            required
            defaultValue={record.slot ?? ""}
            className={inputClassName}
          />
        </Field>
      )}

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={primaryButtonClassName}
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
