import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getBranches } from "@/lib/supabase/queries";
import { getCurrentScope } from "@/lib/shell/get-current-scope";
import { shellSearchParamsSchema } from "@/lib/shell/search-params";
import { AddStudentForm } from "@/components/records/add-student-form";
import { BackLink } from "@/components/shell/back-link";

export const metadata: Metadata = {
  title: "Add Daycare Student",
};

export default async function NewDaycareStudentPage({
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
      <BackLink href="/daycare" />
      <h1 className="mb-4 text-xl font-medium text-ink">Add daycare student</h1>
      <AddStudentForm
        serviceType="daycare"
        branches={branches}
        academicYearId={scope.year.id}
      />
    </div>
  );
}
