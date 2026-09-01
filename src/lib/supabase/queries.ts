import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcademicYearOption,
  BranchOption,
} from "@/lib/shell/resolve-year-branch";
import type { Database } from "@/lib/supabase/database.types";

export async function getAcademicYears(
  supabase: SupabaseClient<Database>,
): Promise<AcademicYearOption[]> {
  const { data, error } = await supabase
    .from("academic_year")
    .select("id, label, is_current, starts_on, ends_on")
    .order("starts_on", { ascending: false });

  if (error) {
    throw new Error("Could not load academic years.");
  }

  return data.map((row) => ({
    id: row.id,
    label: row.label,
    isCurrent: row.is_current,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }));
}

export async function getBranches(
  supabase: SupabaseClient<Database>,
): Promise<BranchOption[]> {
  const { data, error } = await supabase
    .from("branch")
    .select("id, code, name, is_active")
    .order("code", { ascending: true });

  if (error) {
    throw new Error("Could not load branches.");
  }

  return data.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
  }));
}
