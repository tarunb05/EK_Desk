"use client";

import { useEffect, useRef } from "react";

// After a submit comes back with field errors, moves focus (and scroll) to
// the first field that has one -- on a long form the error next to, say,
// Admission number can otherwise be far above the submit button, off
// screen. Field renders each error as a role="alert" inside the field's
// <label>, so the control to focus is the first focusable element in that
// label. Keyed on the fieldErrors object, which is new on every submit.
export function useFocusFirstError(
  fieldErrors: Record<string, string> | undefined,
) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!fieldErrors || Object.keys(fieldErrors).length === 0) return;
    const alert = formRef.current?.querySelector('label [role="alert"]');
    const control = alert
      ?.closest("label")
      ?.querySelector<HTMLElement>(
        "input:not([type=hidden]), button, textarea",
      );
    control?.focus();
    control?.scrollIntoView({ block: "center" });
  }, [fieldErrors]);

  return formRef;
}
