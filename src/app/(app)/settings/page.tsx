import { createClient } from "@/lib/supabase/server";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import { AddAcademicYearForm } from "@/components/settings/add-academic-year-form";
import { AddBranchForm } from "@/components/settings/add-branch-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [years, branches] = await Promise.all([
    getAcademicYears(supabase),
    getBranches(supabase),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium text-ink">Settings</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Academic years</h2>

          {years.length > 0 ? (
            <ul className="flex flex-col divide-y divide-hairline">
              {years.map((year) => (
                <li
                  key={year.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-ink">{year.label}</span>
                  {year.isCurrent ? (
                    <span className="rounded-md bg-surface-accent px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-accent">
                      Current
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-secondary">
              No academic years yet — add the first one below.
            </p>
          )}

          <AddAcademicYearForm />
        </section>

        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Branches</h2>

          {branches.length > 0 ? (
            <ul className="flex flex-col divide-y divide-hairline">
              {branches.map((branch) => (
                <li
                  key={branch.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-ink">{branch.name}</span>
                  <span className="text-ink-muted">{branch.code}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-secondary">
              No branches yet — add the first one below.
            </p>
          )}

          <AddBranchForm />
        </section>
      </div>
    </div>
  );
}
