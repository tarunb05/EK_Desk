-- expense_record (20260826000000) inner-joined profile twice (creator,
-- updater) to resolve names. Under security_invoker, RLS on profile
-- applies too, not just on expense -- and only "admin reads profiles" and
-- "teacher reads own profile" exist (role_based_rls,
-- teacher_reads_own_profile). A teacher reading an expense an admin
-- created or edited couldn't read the admin's profile row, so the inner
-- join silently dropped that row from the teacher's own branch-scoped
-- results entirely -- not a permission error, a row that just vanished.
--
-- Fix: resolve the name through a security definer function, same
-- pattern as auth_role()/auth_branch_id() -- it bypasses the caller's own
-- profile-read RLS on purpose, the same way those already do, and returns
-- only a name (already surfaced elsewhere, e.g. "Submitted by" on the
-- approvals queue), nothing more sensitive.
create function profile_full_name(p_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select full_name from profile where id = p_id
$$;

grant execute on function profile_full_name(uuid) to authenticated;

create or replace view expense_record
  with (security_invoker = true) as
select
  e.id,
  e.branch_id,
  b.code as branch_code,
  b.name as branch_name,
  e.academic_year_id,
  e.category_id,
  ec.name as category_name,
  e.amount_paise,
  e.spent_on,
  e.method,
  e.reference,
  e.note,
  e.created_by,
  profile_full_name(e.created_by) as created_by_name,
  e.updated_by,
  profile_full_name(e.updated_by) as updated_by_name,
  e.created_at,
  e.updated_at
from expense e
join branch b on b.id = e.branch_id
join expense_category ec on ec.id = e.category_id;
