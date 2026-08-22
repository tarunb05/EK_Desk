"use client";

import { useEffect } from "react";
import { AlertIcon } from "@/components/shell/nav-icons";
import { primaryButtonClassName } from "@/components/forms/field";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm animate-pop-in rounded-md border border-border bg-surface p-8 text-center">
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
            onClick={reset}
            className={primaryButtonClassName}
          >
            Try again
          </button>
          <a
            href="/transport"
            className="flex h-10 items-center rounded-md border border-border px-4 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
