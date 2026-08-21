import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import {
  recordTableSearchParamsSchema,
  type SortKey,
} from "@/lib/shell/table-params";
import {
  getDistinctClassSections,
  getFeeAccountRecords,
} from "@/lib/records/queries";
import {
  getAgeingBuckets,
  getBreakdownByClass,
  getBreakdownByGroup,
  getCollectionByMonth,
  getDashboardSummary,
} from "@/lib/records/dashboard-queries";
import type { ServiceType } from "@/lib/records/types";
import { paiseToRupees } from "@/lib/domain/money";
import { StatCards } from "@/components/dashboard/stat-cards";
import { BreakdownBarChart } from "@/components/dashboard/charts/breakdown-bar-chart";
import { TableFilters } from "@/components/records/table-filters";
import { RecordTable } from "@/components/records/record-table";

const PAGE_SIZE = 20;

const BUCKET_ORDER = ["not_yet_due", "1-30", "31-60", "60+"] as const;
const BUCKET_LABELS: Record<(typeof BUCKET_ORDER)[number], string> = {
  not_yet_due: "Not yet due",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "60+": "60+ days",
};

interface ServiceScopeDashboardProps {
  serviceType: ServiceType;
  title: string;
  groupByLabel: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// One dashboard, reused by /transport and /daycare with a different
// service_type — the money and aggregation logic exists exactly once.
export async function ServiceScopeDashboard({
  serviceType,
  title,
  groupByLabel,
  searchParams,
}: ServiceScopeDashboardProps) {
  const rawParams = await searchParams;
  const scopeParams = shellSearchParamsSchema.parse(rawParams);
  const tableParams = recordTableSearchParamsSchema.parse(rawParams);

  const supabase = await createClient();
  const { year, branch } = await getCurrentScope(scopeParams);

  const [
    summary,
    ageingBuckets,
    collectionByMonth,
    byClass,
    byGroup,
    classSections,
  ] = await Promise.all([
    getDashboardSummary(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getAgeingBuckets(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getCollectionByMonth(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getBreakdownByClass(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getBreakdownByGroup(supabase, {
      serviceType,
      academicYearId: year.id,
      branch,
    }),
    getDistinctClassSections(supabase, {
      serviceType,
      academicYearId: year.id,
    }),
  ]);

  const records = await getFeeAccountRecords(supabase, {
    serviceType,
    academicYearId: year.id,
    branch,
    table: tableParams,
    page: tableParams.page,
    pageSize: PAGE_SIZE,
  });
  const pagination = records.pagination;

  const ageingByBucket = new Map(ageingBuckets.map((row) => [row.bucket, row]));
  const ageingChartData = BUCKET_ORDER.map((bucket) => ({
    bucket: BUCKET_LABELS[bucket],
    pending: paiseToRupees(ageingByBucket.get(bucket)?.pendingPaise ?? 0n),
  }));

  const flatSearchParams = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-ink">{title}</h1>
        <Link
          href={`/${serviceType}/new`}
          className="h-9 rounded-md bg-accent px-4 text-sm font-medium leading-9 text-surface transition-colors duration-150"
        >
          Add student
        </Link>
      </div>

      <StatCards summary={summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Collection by month
          </h2>
          {collectionByMonth.length === 0 ? (
            <p className="py-8 text-sm text-ink-muted">
              No payments recorded yet for this scope.
            </p>
          ) : (
            <BreakdownBarChart
              data={collectionByMonth.map((row) => ({
                month: row.month,
                collected: paiseToRupees(row.collectedPaise),
              }))}
              categoryKey="month"
              series={[
                {
                  key: "collected",
                  label: "Collected",
                  color: "var(--accent-fill)",
                },
              ]}
            />
          )}
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Ageing
          </h2>
          <BreakdownBarChart
            data={ageingChartData}
            categoryKey="bucket"
            series={[
              {
                key: "pending",
                label: "Pending",
                color: "var(--attention-fill)",
              },
            ]}
          />
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            By class / section
          </h2>
          {byClass.length === 0 ? (
            <p className="py-8 text-sm text-ink-muted">
              No accounts in this scope yet.
            </p>
          ) : (
            <BreakdownBarChart
              data={byClass.map((row) => ({
                classSection: row.label,
                collected: paiseToRupees(row.collectedPaise),
                pending: paiseToRupees(row.pendingPaise),
              }))}
              categoryKey="classSection"
              series={[
                {
                  key: "collected",
                  label: "Collected",
                  color: "var(--positive-fill)",
                },
                {
                  key: "pending",
                  label: "Pending",
                  color: "var(--attention-fill)",
                },
              ]}
            />
          )}
        </div>

        <div className="rounded-md border border-hairline bg-surface p-4">
          <h2 className="mb-2 text-2xs font-medium uppercase tracking-wide text-ink-muted">
            By {groupByLabel.toLowerCase()}
          </h2>
          {byGroup.length === 0 ? (
            <p className="py-8 text-sm text-ink-muted">
              No accounts in this scope yet.
            </p>
          ) : (
            <BreakdownBarChart
              data={byGroup.map((row) => ({
                group: row.label,
                collected: paiseToRupees(row.collectedPaise),
                pending: paiseToRupees(row.pendingPaise),
              }))}
              categoryKey="group"
              series={[
                {
                  key: "collected",
                  label: "Collected",
                  color: "var(--positive-fill)",
                },
                {
                  key: "pending",
                  label: "Pending",
                  color: "var(--attention-fill)",
                },
              ]}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <TableFilters classSections={classSections} />
        <RecordTable
          rows={records.rows}
          serviceType={serviceType}
          sort={tableParams.sort as SortKey}
          dir={tableParams.dir}
          page={pagination.page}
          totalPages={pagination.totalPages}
          searchParams={flatSearchParams}
        />
      </div>
    </div>
  );
}
