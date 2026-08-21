import { createClient } from "@/lib/supabase/server";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import {
  resolveYearAndBranch,
  type ResolvedYearBranch,
} from "@/lib/shell/resolve-year-branch";
import type { ShellSearchParams } from "@/lib/shell/search-params";

export async function getCurrentScope(
  params: ShellSearchParams,
): Promise<ResolvedYearBranch> {
  const supabase = await createClient();
  const [years, branches] = await Promise.all([
    getAcademicYears(supabase),
    getBranches(supabase),
  ]);

  return resolveYearAndBranch(params, years, branches);
}
