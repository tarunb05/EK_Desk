import { createClient } from "@/lib/supabase/server";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import {
  studentDirectorySearchParamsSchema,
  type StudentSortKey,
} from "@/lib/shell/student-table-params";
import {
  getStudentClassSections,
  getStudentDirectory,
} from "@/lib/records/student-directory";
import { StudentDirectoryFilters } from "@/components/students/student-directory-filters";
import { StudentDirectoryTable } from "@/components/students/student-directory-table";

const PAGE_SIZE = 20;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const scopeParams = shellSearchParamsSchema.parse(rawParams);
  const tableParams = studentDirectorySearchParamsSchema.parse(rawParams);

  const supabase = await createClient();
  const [{ branch }, classSections] = await Promise.all([
    getCurrentScope(scopeParams),
    getStudentClassSections(supabase),
  ]);

  const { rows, pagination } = await getStudentDirectory(supabase, {
    branch,
    service: tableParams.service,
    table: tableParams,
    page: tableParams.page,
    pageSize: PAGE_SIZE,
  });

  const flatSearchParams = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium text-ink">Students</h1>

      <StudentDirectoryFilters classSections={classSections} />

      <StudentDirectoryTable
        rows={rows}
        sort={tableParams.sort as StudentSortKey}
        dir={tableParams.dir}
        page={pagination.page}
        totalPages={pagination.totalPages}
        searchParams={flatSearchParams}
      />
    </div>
  );
}
