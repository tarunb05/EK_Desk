"use client";

import { useId, useState } from "react";
import { Field, inputClassName } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { DateField, toIso } from "@/components/forms/date-field";
import { Checkbox } from "@/components/forms/checkbox";
import { METHOD_OPTIONS } from "@/components/records/record-payment-form";

// The optional "Paid — record a payment now" part of the enrollment forms:
// a checkbox that, when ticked, asks for the amount (starting at the total
// and lowerable for a part-payment), the date, the method and a reference.
// The fields post as paid / paidAmount / paidOn / paidMethod /
// paidReference, which initialPaymentSchema reads.
export function PaymentNowFields({
  totalReceivable,
  errors,
}: {
  totalReceivable: string;
  errors?: Record<string, string>;
}) {
  const checkboxId = useId();
  const [paid, setPaid] = useState(false);
  // Null until staff type their own amount, so the field simply follows the
  // total (even if they change it afterwards) until they do.
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  function handlePaidChange(next: boolean) {
    setPaid(next);
    if (next && !paidOn) setPaidOn(toIso(new Date()));
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          name="paid"
          checked={paid}
          onChange={handlePaidChange}
        />
        <label htmlFor={checkboxId} className="text-sm text-ink-secondary">
          Paid — record a payment now
        </label>
      </div>

      {paid ? (
        <>
          <Field label="Amount paid (₹)" error={errors?.paidAmount}>
            <input
              name="paidAmount"
              type="number"
              min="0"
              step="1"
              required
              value={amountOverride ?? totalReceivable}
              onChange={(event) => setAmountOverride(event.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="Paid on" error={errors?.paidOn}>
            <DateField
              name="paidOn"
              required
              ariaLabel="Paid on"
              value={paidOn}
              onChange={setPaidOn}
            />
          </Field>

          <Field label="Method" error={errors?.paidMethod}>
            <Select
              name="paidMethod"
              ariaLabel="Method"
              value={method}
              onChange={setMethod}
              options={METHOD_OPTIONS}
            />
          </Field>

          <Field label="Reference (optional)">
            <input
              name="paidReference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className={inputClassName}
            />
          </Field>
        </>
      ) : null}
    </>
  );
}
