"use client";

import { useActionState, useState } from "react";
import { useFocusFirstError } from "@/components/forms/use-focus-first-error";
import { useUnsavedChangesWarning } from "@/components/forms/use-unsaved-changes-warning";
import {
  Field,
  FormError,
  inputClassName,
  primaryButtonClassName,
} from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { DateField, toIso } from "@/components/forms/date-field";
import { Checkbox } from "@/components/forms/checkbox";
import { METHOD_OPTIONS } from "@/components/records/record-payment-form";
import {
  createStudentWithFeeAccount,
  type ActionState,
} from "@/lib/records/actions";
import type { ServiceType } from "@/lib/records/types";
import type { BranchOption } from "@/lib/shell/resolve-year-branch";
import { CLASS_SECTIONS } from "@/lib/records/class-sections";
import {
  enrollmentEndsOn,
  type EnrollmentPeriod,
} from "@/lib/domain/enrollment-period";

const initialState: ActionState = { error: null };

const PERIOD_OPTIONS: { value: EnrollmentPeriod | ""; label: string }[] = [
  { value: "", label: "Choose a period" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

interface AddStudentFormProps {
  serviceType: ServiceType;
  branches: BranchOption[];
  academicYearId: string;
  academicYearEndsOn: string;
}

export function AddStudentForm({
  serviceType,
  branches,
  academicYearId,
  academicYearEndsOn,
}: AddStudentFormProps) {
  const [state, formAction, isPending] = useActionState(
    createStudentWithFeeAccount,
    initialState,
  );
  const formRef = useFocusFirstError(state.fieldErrors);
  useUnsavedChangesWarning(formRef, isPending);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [classSection, setClassSection] = useState("");
  // React resets every *uncontrolled* field in a <form action={...}> once
  // the action returns -- on a validation failure just as much as on
  // success, since React can't tell the difference from here. Branch and
  // Grade above never had this problem because Select already drives them
  // from React state; every other field here was a plain uncontrolled
  // <input>, which is exactly what was emptying out the whole form on a
  // single missing box instead of leaving it filled in with just that one
  // box highlighted.
  const [admissionNo, setAdmissionNo] = useState("");
  const [fullName, setFullName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [pickupPoint, setPickupPoint] = useState("");
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [totalReceivable, setTotalReceivable] = useState("");
  // Daycare only: picking a period fills both dates, which stay editable.
  const [period, setPeriod] = useState<EnrollmentPeriod | "">("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  // Optional payment taken while adding the student; the amount starts at
  // Total receivable and can be lowered for a part-payment.
  const [paid, setPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [paidMethod, setPaidMethod] = useState("cash");
  const [paidReference, setPaidReference] = useState("");

  function handlePaidChange(next: boolean) {
    setPaid(next);
    if (!next) return;
    if (!paidAmount) setPaidAmount(totalReceivable);
    if (!paidOn) setPaidOn(toIso(new Date()));
  }

  // Keeps Amount paid following Total receivable until staff type their
  // own amount (a part-payment) -- after that it's left alone.
  function handleTotalReceivableChange(next: string) {
    if (paidAmount === "" || paidAmount === totalReceivable) {
      setPaidAmount(next);
    }
    setTotalReceivable(next);
  }

  function handlePeriodChange(next: string) {
    const nextPeriod = next as EnrollmentPeriod | "";
    setPeriod(nextPeriod);
    if (!nextPeriod) return;
    const start = startsOn || toIso(new Date());
    setStartsOn(start);
    setEndsOn(enrollmentEndsOn(start, nextPeriod, academicYearEndsOn));
  }

  function handleStartsOnChange(next: string) {
    setStartsOn(next);
    if (period) setEndsOn(enrollmentEndsOn(next, period, academicYearEndsOn));
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
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
        <input
          name="admissionNo"
          required
          value={admissionNo}
          onChange={(event) => setAdmissionNo(event.target.value)}
          className={inputClassName}
        />
      </Field>

      <Field label="Student full name" error={state.fieldErrors?.fullName}>
        <input
          name="fullName"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={inputClassName}
        />
      </Field>

      <Field label="Guardian name" error={state.fieldErrors?.guardianName}>
        <input
          name="guardianName"
          required
          value={guardianName}
          onChange={(event) => setGuardianName(event.target.value)}
          className={inputClassName}
        />
      </Field>

      <Field label="Phone" error={state.fieldErrors?.phone}>
        <input
          name="phone"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={inputClassName}
        />
      </Field>

      <Field
        label="WhatsApp number (optional)"
        error={state.fieldErrors?.whatsappPhone}
      >
        <input
          name="whatsappPhone"
          value={whatsappPhone}
          onChange={(event) => setWhatsappPhone(event.target.value)}
          className={inputClassName}
          placeholder="If different from Phone above"
        />
      </Field>

      {/* Every daycare student's grade is "Daycare", so there's nothing to pick. */}
      {serviceType === "daycare" ? (
        <input type="hidden" name="classSection" value="Daycare" />
      ) : (
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
      )}

      <Field label="Notes (optional)" error={state.fieldErrors?.notes}>
        <input
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={inputClassName}
        />
      </Field>

      {serviceType === "transport" ? (
        <Field label="Pickup point" error={state.fieldErrors?.pickupPoint}>
          <input
            name="pickupPoint"
            required
            value={pickupPoint}
            onChange={(event) => setPickupPoint(event.target.value)}
            className={inputClassName}
          />
        </Field>
      ) : (
        <Field label="Slot" error={state.fieldErrors?.slot}>
          <input
            name="slot"
            required
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
            className={inputClassName}
          />
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
          value={totalReceivable}
          onChange={(event) => handleTotalReceivableChange(event.target.value)}
          className={inputClassName}
        />
      </Field>

      <Field label="Due date" error={state.fieldErrors?.dueDate}>
        <DateField name="dueDate" required ariaLabel="Due date" />
      </Field>

      {serviceType === "daycare" ? (
        <Field label="Enrollment period">
          <Select
            ariaLabel="Enrollment period"
            value={period}
            onChange={handlePeriodChange}
            options={PERIOD_OPTIONS}
          />
        </Field>
      ) : null}

      <Field label="Starts on" error={state.fieldErrors?.startsOn}>
        <DateField
          name="startsOn"
          required
          ariaLabel="Starts on"
          value={startsOn}
          onChange={handleStartsOnChange}
        />
      </Field>

      <Field label="Ends on" error={state.fieldErrors?.endsOn}>
        <DateField
          name="endsOn"
          required
          ariaLabel="Ends on"
          value={endsOn}
          onChange={setEndsOn}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox
          id="paid"
          name="paid"
          checked={paid}
          onChange={handlePaidChange}
        />
        <label htmlFor="paid" className="text-sm text-ink-secondary">
          Paid — record a payment now
        </label>
      </div>

      {paid ? (
        <>
          <Field label="Amount paid (₹)" error={state.fieldErrors?.paidAmount}>
            <input
              name="paidAmount"
              type="number"
              min="0"
              step="1"
              required
              value={paidAmount}
              onChange={(event) => setPaidAmount(event.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="Paid on" error={state.fieldErrors?.paidOn}>
            <DateField
              name="paidOn"
              required
              ariaLabel="Paid on"
              value={paidOn}
              onChange={setPaidOn}
            />
          </Field>

          <Field label="Method" error={state.fieldErrors?.paidMethod}>
            <Select
              name="paidMethod"
              ariaLabel="Method"
              value={paidMethod}
              onChange={setPaidMethod}
              options={METHOD_OPTIONS}
            />
          </Field>

          <Field label="Reference (optional)">
            <input
              name="paidReference"
              value={paidReference}
              onChange={(event) => setPaidReference(event.target.value)}
              className={inputClassName}
            />
          </Field>
        </>
      ) : null}

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={`${primaryButtonClassName} flex items-center justify-center gap-2`}
      >
        {isPending ? (
          <>
            {/* Same loading-ring pattern as the Sign in button (login-form.tsx)
                -- border-surface since this sits on the same dark --accent
                background. */}
            <span
              aria-hidden="true"
              className="animate-loading-ring h-4 w-4 rounded-full border-2 border-surface/30 border-t-surface"
            />
            Saving…
          </>
        ) : (
          "Add student"
        )}
      </button>
    </form>
  );
}
