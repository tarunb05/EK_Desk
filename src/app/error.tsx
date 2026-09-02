"use client";

import { ErrorCard } from "@/components/shell/error-card";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorCard error={error} backHref="/transport" />;
}
