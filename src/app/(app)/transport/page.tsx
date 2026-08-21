import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";

export default async function TransportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = shellSearchParamsSchema.parse(await searchParams);
  const { year, branch } = await getCurrentScope(params);

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-medium text-ink">Transport</h1>
      <p className="text-sm text-ink-secondary">
        {year.label} · {branch === "all" ? "All branches" : branch}
      </p>
      <p className="text-sm text-ink-muted">
        The transport dashboard is built in Phase 4 — record a student with a
        transport fee account to see figures here.
      </p>
    </div>
  );
}
