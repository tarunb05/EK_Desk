"use client";

import { useState } from "react";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { toIso } from "@/components/forms/date-field";
import {
  enrollmentEndsOn,
  type EnrollmentPeriod,
} from "@/lib/domain/enrollment-period";

const PERIOD_OPTIONS: { value: EnrollmentPeriod | ""; label: string }[] = [
  { value: "", label: "Choose a period" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// Daycare enrollment dates: picking a period fills Starts on (today, unless
// already chosen) and Ends on, and changing Starts on moves Ends on with it;
// both stay editable. `yearEndsOn` says where a yearly stint ends for a
// given start date (the end of the academic year it starts in).
export function useEnrollmentDates(yearEndsOn: (startsOn: string) => string) {
  const [period, setPeriod] = useState<EnrollmentPeriod | "">("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  function handlePeriodChange(next: string) {
    const nextPeriod = next as EnrollmentPeriod | "";
    setPeriod(nextPeriod);
    if (!nextPeriod) return;
    const start = startsOn || toIso(new Date());
    setStartsOn(start);
    setEndsOn(enrollmentEndsOn(start, nextPeriod, yearEndsOn(start)));
  }

  function handleStartsOnChange(next: string) {
    setStartsOn(next);
    if (period) setEndsOn(enrollmentEndsOn(next, period, yearEndsOn(next)));
  }

  return {
    period,
    startsOn,
    endsOn,
    setEndsOn,
    handlePeriodChange,
    handleStartsOnChange,
  };
}

export function EnrollmentPeriodField({
  value,
  onChange,
}: {
  value: EnrollmentPeriod | "";
  onChange: (next: string) => void;
}) {
  return (
    <Field label="Enrollment period">
      <Select
        ariaLabel="Enrollment period"
        value={value}
        onChange={onChange}
        options={PERIOD_OPTIONS}
      />
    </Field>
  );
}
