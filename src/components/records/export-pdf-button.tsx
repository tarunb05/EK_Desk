"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { exportRecordsPdf } from "@/lib/records/export-pdf";
import { recordTableSearchParamsSchema } from "@/lib/shell/table-params";
import type { ServiceType } from "@/lib/records/types";

interface ExportPdfButtonProps {
  serviceType: ServiceType;
  academicYearId: string;
  branch: "all" | string;
  yearLabel: string;
  branchLabel: string;
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

export function ExportPdfButton({
  serviceType,
  academicYearId,
  branch,
  yearLabel,
  branchLabel,
}: ExportPdfButtonProps) {
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsPending(true);
    setError(null);
    try {
      const table = recordTableSearchParamsSchema.parse(
        Object.fromEntries(searchParams.entries()),
      );
      const base64Pdf = await exportRecordsPdf({
        serviceType,
        academicYearId,
        branch,
        table,
        yearLabel,
        branchLabel,
      });
      const blob = base64ToBlob(base64Pdf, "application/pdf");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${serviceType}-records.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export the report. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="h-9 rounded-md border border-border px-4 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {isPending ? "Exporting…" : "Export PDF"}
      </button>
      {error ? (
        <p className="text-xs text-attention" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
