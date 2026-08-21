import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";

export default async function DaycarePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = shellSearchParamsSchema.parse(await searchParams);
  const { year, branch } = await getCurrentScope(params);

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-medium text-ink">Daycare</h1>
      <p className="text-sm text-ink-secondary">
        {year.label} · {branch === "all" ? "All branches" : branch}
      </p>
      <p className="text-sm text-ink-muted">
        The daycare dashboard is built in Phase 5 — record a student with a
        daycare fee account to see figures here.
      </p>
    </div>
  );
}
