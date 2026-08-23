import { createClient } from "@/lib/supabase/server";
import { getAcademicYears, getBranches } from "@/lib/supabase/queries";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeachersWithBranch } from "@/lib/settings/queries";
import { internalEmailToUsername } from "@/lib/auth/username";
import { AddAcademicYearForm } from "@/components/settings/add-academic-year-form";
import { AddBranchForm } from "@/components/settings/add-branch-form";
import { AddTeacherForm } from "@/components/settings/add-teacher-form";
import { TeacherRow } from "@/components/settings/teacher-row";
import { MyCredentialsForm } from "@/components/settings/my-credentials-form";

export default async function SettingsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [years, branches, { data: { user } }] = await Promise.all([
    getAcademicYears(supabase),
    getBranches(supabase),
    supabase.auth.getUser(),
  ]);
  const myUsername = user?.email ? internalEmailToUsername(user.email) : "";

  // Listing teachers needs the admin client (see getTeachersWithBranch) --
  // if the service-role key isn't configured, the section still renders,
  // just without a list and with a message instead of a crash.
  let teachers: Awaited<ReturnType<typeof getTeachersWithBranch>> = [];
  let teachersUnavailable = false;
  try {
    teachers = await getTeachersWithBranch(createAdminClient());
  } catch {
    teachersUnavailable = true;
  }

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

      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Teachers</h2>

        {teachersUnavailable ? (
          <p className="text-sm text-attention">
            Could not load teacher logins — the server isn&apos;t configured
            with a service-role key yet.
          </p>
        ) : teachers.length > 0 ? (
          <ul className="flex flex-col divide-y divide-hairline">
            {teachers.map((teacher) => (
              <TeacherRow key={teacher.id} teacher={teacher} branches={branches} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-secondary">
            No teacher logins yet — add the first one below.
          </p>
        )}

        <AddTeacherForm branches={branches} />
      </section>

      <section className="flex max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">My login</h2>
        <MyCredentialsForm currentUsername={myUsername} />
      </section>
    </div>
  );
}
