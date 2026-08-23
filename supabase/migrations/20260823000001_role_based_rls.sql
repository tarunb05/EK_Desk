-- Role-reading functions. security definer so they can read `profile` even
-- though the calling session (teacher or admin) has no direct RLS grant to
-- read arbitrary profile rows -- these are the one sanctioned way anything
-- reads role/branch, so a later swap to a JWT-claim source only means
-- changing the body of these three functions, never the policies below.
-- Both filter on is_active so a deactivated teacher (or admin) resolves to
-- no role at all everywhere in the app the moment they're deactivated --
-- one check here instead of a separate is_active check at every call site.
create function auth_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profile where id = auth.uid() and is_active
$$;

create function auth_branch_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select branch_id from profile where id = auth.uid() and is_active
$$;

create function auth_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth_role() = 'admin'
$$;

grant execute on function auth_role() to authenticated;
grant execute on function auth_branch_id() to authenticated;
grant execute on function auth_is_admin() to authenticated;

-- profile itself: admins can list users (Settings -> Users, phase 8.2).
-- No insert/update/delete policy for anyone -- role and branch_id changes
-- go through an admin-gated security definer function once 8.2 needs one,
-- never a direct row update through the anon or authenticated key.
alter table profile enable row level security;
grant select on profile to authenticated;
-- service_role writes profile rows directly (seed scripts, and the
-- Settings -> Users admin-invite flow in phase 8.2) -- RLS bypass alone
-- isn't enough, the underlying table privilege still has to exist. The
-- original rls_policies migration never granted service_role anything
-- because nothing had used the JS client's service-role key against
-- PostgREST before now (existing seed scripts connect directly as the
-- postgres superuser); seed-auth-user.ts's branch lookup needs this too.
grant select, insert, update on profile to service_role;
grant select on branch to service_role;

create policy "admin reads profiles" on profile
  for select to authenticated
  using (auth_is_admin());

-- branch / academic_year: both roles can read (a teacher's one screen still
-- needs branch names and the current year), only admins can write. Settings
-- is an admin-only route, but until now anyone authenticated could write
-- these tables directly -- that was fine when "authenticated" meant one
-- admin login; it stops being fine the moment teachers exist.
create policy "admin write access" on branch
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "admin write access" on academic_year
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "read access" on branch
  for select to authenticated
  using (true);

create policy "read access" on academic_year
  for select to authenticated
  using (true);

drop policy "authenticated full access" on branch;
drop policy "authenticated full access" on academic_year;

-- student: admin unchanged, teacher gets read-only access to their own
-- branch and nothing else. fee_account has no branch_id column of its own,
-- so this is the one table a branch filter can apply to directly.
create policy "admin full access" on student
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher reads own branch" on student
  for select to authenticated
  using (auth_role() = 'teacher' and branch_id = auth_branch_id());

drop policy "authenticated full access" on student;

-- fee_account: admin unchanged. Teachers get read-only access scoped to
-- their own branch (joined through student, since fee_account has no
-- branch_id of its own) -- individual pending/receivable figures and
-- payment history on the Students page are fine for a teacher to see; only
-- the dashboards (admin-only routes, unrelated to RLS) and any aggregate
-- stay off limits. fee_account_balance / fee_account_record are already
-- security_invoker (see their own migrations), so both inherit this
-- automatically -- no changes needed there.
create policy "admin full access" on fee_account
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher reads own branch" on fee_account
  for select to authenticated
  using (
    auth_role() = 'teacher'
    and exists (
      select 1 from student s
      where s.id = fee_account.student_id and s.branch_id = auth_branch_id()
    )
  );

drop policy "authenticated full access" on fee_account;

-- payment: admin unchanged. Teachers get read-only access to their own
-- branch's payment history (to check for a wrong entry), joined through
-- fee_account -> student. Writes still only ever happen through
-- payment_submission (see the submissions migration) -- this policy is
-- select-only for a teacher.
create policy "admin full access" on payment
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher reads own branch" on payment
  for select to authenticated
  using (
    auth_role() = 'teacher'
    and exists (
      select 1 from fee_account fa
      join student s on s.id = fa.student_id
      where fa.id = payment.fee_account_id and s.branch_id = auth_branch_id()
    )
  );

drop policy "authenticated full access" on payment;
