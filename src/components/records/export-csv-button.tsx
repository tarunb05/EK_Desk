"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { exportRecordsCsv } from "@/lib/records/export";
import { recordTableSearchParamsSchema } from "@/lib/shell/table-params";
import type { ServiceType } from "@/lib/records/types";

interface ExportCsvButtonProps {
  serviceType: ServiceType;
  academicYearId: string;
  branch: "all" | string;
}

export function ExportCsvButton({
  serviceType,
  academicYearId,
  branch,
}: ExportCsvButtonProps) {
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
      const csv = await exportRecordsCsv({
        serviceType,
        academicYearId,
        branch,
        table,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${serviceType}-records.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export records. Please try again.");
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
        {isPending ? "Exporting…" : "Export CSV"}
      </button>
      {error ? (
        <p className="text-xs text-attention" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
