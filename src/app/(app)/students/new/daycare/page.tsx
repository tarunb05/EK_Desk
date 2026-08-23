import { createClient } from "@/lib/supabase/server";
import { getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import { requireAuth } from "@/lib/auth/require-role";
import { AddStudentForm } from "@/components/records/add-student-form";
import { BackLink } from "@/components/shell/back-link";

export default async function NewDaycareStudentFromStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = shellSearchParamsSchema.parse(await searchParams);
  const authed = await requireAuth();
  const supabase = await createClient();
  const [allBranches, scope] = await Promise.all([
    getBranches(supabase),
    getCurrentScope(params),
  ]);

  const branches =
    authed.role === "teacher"
      ? allBranches.filter((branch) => branch.id === authed.branchId)
      : allBranches;

  return (
    <div className="max-w-xl">
      <BackLink href="/students" />
      <h1 className="mb-4 text-xl font-medium text-ink">
        Add daycare student
      </h1>
      <AddStudentForm
        serviceType="daycare"
        branches={branches}
        academicYearId={scope.year.id}
      />
    </div>
  );
}
