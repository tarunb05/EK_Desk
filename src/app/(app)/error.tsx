"use client";

import { ErrorCard } from "@/components/shell/error-card";

// A boundary of its own (rather than relying on the root one) so an error
// anywhere inside the app shell -- Transport, Daycare, Students, Approvals,
// Settings -- keeps the sidebar and top bar mounted and shows the error as
// a popup card over them, instead of the root boundary tearing down the
// whole shell and rendering a blank full-page takeover.
export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorCard error={error} backHref="/transport" />;
}
