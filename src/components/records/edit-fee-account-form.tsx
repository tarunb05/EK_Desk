"use client";

import { useActionState, useState } from "react";
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { type ActionState, updateFeeAccount } from "@/lib/records/actions";
import { paiseToRupees } from "@/lib/domain/money";
import type { FeeAccountRecordRow } from "@/lib/records/types";

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

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="feeAccountId" value={record.feeAccountId} />

      <Field label="Total receivable (₹)">
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

      <Field label="Due date">
        <input
          name="dueDate"
          type="date"
          required
          defaultValue={record.dueDate}
          className={inputClassName}
        />
      </Field>

      <Field label="Starts on">
        <input
          name="startsOn"
          type="date"
          required
          defaultValue={record.startsOn}
          className={inputClassName}
        />
      </Field>

      <Field label="Ends on">
        <input
          name="endsOn"
          type="date"
          required
          defaultValue={record.endsOn}
          className={inputClassName}
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
          <Field label="Pickup point">
            <input
              name="pickupPoint"
              required
              defaultValue={record.pickupPoint ?? ""}
              className={inputClassName}
            />
          </Field>
        </>
      ) : (
        <Field label="Slot">
          <input
            name="slot"
            required
            defaultValue={record.slot ?? ""}
            className={inputClassName}
          />
        </Field>
      )}

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
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
