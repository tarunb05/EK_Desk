import { createClient } from "@/lib/supabase/server";
import { getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import { AddStudentForm } from "./add-student-form";

export default async function NewTransportStudentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = shellSearchParamsSchema.parse(await searchParams);
  const supabase = await createClient();
  const [branches, scope] = await Promise.all([
    getBranches(supabase),
    getCurrentScope(params),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-medium text-ink">
        Add transport student
      </h1>
      <AddStudentForm branches={branches} academicYearId={scope.year.id} />
    </div>
  );
}
