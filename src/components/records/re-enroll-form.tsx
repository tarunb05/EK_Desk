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
import { DateField } from "@/components/forms/date-field";
import {
  EnrollmentPeriodField,
  useEnrollmentDates,
} from "@/components/records/enrollment-date-fields";
import { PaymentNowFields } from "@/components/records/payment-now-fields";
import { reEnrollStudent, type ActionState } from "@/lib/records/actions";
import { academicYearContaining } from "@/lib/domain/academic-year";
import { CLASS_SECTIONS } from "@/lib/records/class-sections";
import type { ReEnrollContext } from "@/lib/records/re-enroll";

const initialState: ActionState = { error: null };

interface YearRange {
  id: string;
  startsOn: string;
  endsOn: string;
}

// Laid out like the edit form: the student's details and slot come pre-filled
// from what's on file (and can be corrected on the way through); the money
// and the dates start blank, because they're what's new about this stint.
export function ReEnrollForm({
  student,
  suggestedSlot,
  years,
  fallbackYearId,
}: {
  student: ReEnrollContext["student"];
  suggestedSlot: string;
  years: YearRange[];
  // Used when a start date falls outside every academic year; the action
  // otherwise files the stint under the year it starts in.
  fallbackYearId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    reEnrollStudent,
    initialState,
  );
  const formRef = useFocusFirstError(state.fieldErrors);
  useUnsavedChangesWarning(formRef, isPending);

  // Controlled, so a failed save leaves what was typed in place instead of
  // resetting the form (see add-student-form.tsx).
  const [fullName, setFullName] = useState(student.fullName);
  const [guardianName, setGuardianName] = useState(student.guardianName);
  const [phone, setPhone] = useState(student.phone);
  const [whatsappPhone, setWhatsappPhone] = useState(student.whatsappPhone);
  const [classSection, setClassSection] = useState(student.classSection);
  const [notes, setNotes] = useState(student.notes);
  const [slot, setSlot] = useState(suggestedSlot);
  const [totalReceivable, setTotalReceivable] = useState("");

  const fallbackEnd =
    years.find((year) => year.id === fallbackYearId)?.endsOn ?? "";
  const {
    period,
    startsOn,
    endsOn,
    setEndsOn,
    handlePeriodChange,
    handleStartsOnChange,
  } = useEnrollmentDates(
    (start) => academicYearContaining(start, years)?.endsOn ?? fallbackEnd,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="studentId" value={student.id} />
      <input type="hidden" name="academicYearId" value={fallbackYearId} />

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
          type="tel"
          inputMode="tel"
          autoComplete="off"
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
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={whatsappPhone}
          onChange={(event) => setWhatsappPhone(event.target.value)}
          className={inputClassName}
          placeholder="If different from Phone above"
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

      <Field label="Notes (optional)" error={state.fieldErrors?.notes}>
        <input
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={inputClassName}
        />
      </Field>

      <Field label="Slot" error={state.fieldErrors?.slot}>
        <input
          name="slot"
          required
          value={slot}
          onChange={(event) => setSlot(event.target.value)}
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
          value={totalReceivable}
          onChange={(event) => setTotalReceivable(event.target.value)}
          className={inputClassName}
        />
      </Field>

      <Field label="Due date" error={state.fieldErrors?.dueDate}>
        <DateField name="dueDate" required ariaLabel="Due date" />
      </Field>

      <EnrollmentPeriodField value={period} onChange={handlePeriodChange} />

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

      <PaymentNowFields
        totalReceivable={totalReceivable}
        errors={state.fieldErrors}
      />

      <FormError error={state.error} />

      <button
        type="submit"
        disabled={isPending}
        className={`${primaryButtonClassName} flex items-center justify-center gap-2`}
      >
        {isPending ? (
          <>
            <span
              aria-hidden="true"
              className="animate-loading-ring h-4 w-4 rounded-full border-2 border-surface/30 border-t-surface"
            />
            Saving…
          </>
        ) : (
          "Re-enroll student"
        )}
      </button>
    </form>
  );
}
