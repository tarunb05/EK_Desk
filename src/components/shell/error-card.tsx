"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon } from "@/components/shell/nav-icons";
import { primaryButtonClassName } from "@/components/forms/field";

// A native <dialog> instead of a full-page takeover -- this shows up as a
// popup card over whatever was already on screen (the sidebar/nav included,
// when rendered inside the (app) layout's own error boundary) rather than
// replacing the entire page. "Try again" navigates back to the page the
// error happened on instead of retrying the same route in place, since the
// error usually came from an action taken there, not from the page itself
// failing to load.
export function ErrorCard({
  error,
  backHref,
}: {
  error: Error & { digest?: string };
  backHref: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    dialogRef.current?.showModal();
  }, [error]);

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-sm rounded-md border border-border bg-surface p-0 text-ink shadow-[0_1px_2px_rgba(0,0,0,.05)] backdrop:bg-ink/30"
    >
      <div className="p-8 text-center">
        <span className="inline-flex text-attention">
          <AlertIcon size={32} />
        </span>
        <h1 className="mt-3 text-lg font-medium text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Nothing was saved. Try again, or go back to the dashboard if it keeps
          happening.
          {error.digest ? (
            <span className="mt-1 block font-mono text-2xs text-ink-muted">
              Reference: {error.digest}
            </span>
          ) : null}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className={`${primaryButtonClassName} px-4`}
          >
            Try again
          </button>
          <a
            href={backHref}
            className="flex h-10 items-center rounded-md border border-border px-4 text-sm text-ink-secondary transition-[background-color,color,transform] duration-150 hover:bg-surface-accent hover:text-ink active:scale-[0.98]"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </dialog>
  );
}
