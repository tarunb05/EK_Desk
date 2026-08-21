import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = shellSearchParamsSchema.parse(await searchParams);
  const { year, branch } = await getCurrentScope(params);

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-medium text-ink">Students</h1>
      <p className="text-sm text-ink-secondary">
        {year.label} · {branch === "all" ? "All branches" : branch}
      </p>
      <p className="text-sm text-ink-muted">
        The student directory is built alongside the transport and daycare
        record screens — add a student there to see them listed here.
      </p>
    </div>
  );
}
