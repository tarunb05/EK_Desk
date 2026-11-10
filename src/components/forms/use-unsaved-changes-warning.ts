"use client";

import { useEffect, useRef, type RefObject } from "react";

const LEAVE_MESSAGE =
  "You have unsaved changes. Leave this page without saving them?";

function snapshot(form: HTMLFormElement): string {
  return JSON.stringify(Array.from(new FormData(form).entries()));
}

// Asks before leaving a form that has unsaved input -- closing or reloading
// the tab (beforeunload) or following any link in the app (sidebar, Back,
// a breadcrumb). "Unsaved" means the form's values differ from when it
// first rendered, compared via FormData, so the custom Select/DateField
// controls count too (they mirror their value into hidden inputs). Quiet
// while the form is submitting, so a successful save's redirect never
// prompts. The browser's own Back button can't be intercepted in the App
// Router; this covers everything else.
export function useUnsavedChangesWarning(
  formRef: RefObject<HTMLFormElement | null>,
  isSubmitting: boolean,
) {
  const submittingRef = useRef(isSubmitting);
  submittingRef.current = isSubmitting;

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const initial = snapshot(form);
    const isDirty = () => !submittingRef.current && snapshot(form) !== initial;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty()) return;
      event.preventDefault();
      // Still required by some browsers to show the prompt at all.
      event.returnValue = "";
    }

    // Capture phase on document runs before next/link's own click handler,
    // which skips navigation once the event is defaultPrevented.
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!isDirty() || window.confirm(LEAVE_MESSAGE)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [formRef]);
}
