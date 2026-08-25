-- Phase 9.1: student.status gains a third value (withdrawn), and a teacher
-- may change it -- own branch only -- while remaining unable to touch any
-- other column on the row, including fee_account.status. Column-level
-- privilege can't do that here, because admin and teacher are the same
-- Postgres role (`authenticated`); the app/teacher split lives entirely in
-- RLS reading `profile`. So this is enforced the same way payment's
-- append-only rule already is (see payment_enforce_append_only): a trigger
-- that inspects OLD vs NEW, plus RLS for the row-level (own-branch) scoping.

alter table student drop constraint student_status_check;
alter table student add constraint student_status_check
  check (status in ('active', 'inactive', 'withdrawn'));

create function student_enforce_teacher_status_only()
returns trigger
language plpgsql
as $$
begin
  if (select auth_role()) = 'teacher' then
    if new.branch_id <> old.branch_id
      or new.admission_no <> old.admission_no
      or new.full_name <> old.full_name
      or new.guardian_name <> old.guardian_name
      or new.phone <> old.phone
      or new.class_section <> old.class_section
      or coalesce(new.notes, '') <> coalesce(old.notes, '')
    then
      raise exception 'a teacher may only change a student''s status';
    end if;
  end if;

  return new;
end;
$$;

create trigger student_teacher_status_only_guard
  before update on student
  for each row
  execute function student_enforce_teacher_status_only();

-- Row-level scoping: a teacher may update status only on their own
-- branch's students. Wrapped in (select ...) per the RLS performance
-- guidance -- evaluated once via InitPlan rather than once per row.
create policy "teacher updates own branch status" on student
  for update to authenticated
  using (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
  )
  with check (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
  );

-- fee_account.status needs no new policy: the existing "admin full access"
-- (for all) policy already covers admin updates, and a teacher has no
-- write policy on fee_account at all -- exactly "cannot touch", already
-- true with zero changes here.

-- Expose each fee_account's status in the Students list's per-account
-- array so the row can show a Service-status control -- append-only change
-- (new fields at the end of the json_build_object) on top of the version
-- 20260821000010 last defined (the "exclude discontinued" filters on
-- total_pending_paise/has_overdue), not the original 20260821000009 one.
create or replace view student_directory
with (security_invoker = true) as
select
  s.id,
  s.full_name,
  s.admission_no,
  s.class_section,
  s.phone,
  s.guardian_name,
  s.status,
  s.created_at,
  b.code as branch_code,
  b.name as branch_name,
  coalesce(agg.fee_account_count, 0) as fee_account_count,
  coalesce(agg.total_pending_paise, 0) as total_pending_paise,
  coalesce(agg.has_overdue, false) as has_overdue,
  coalesce(agg.has_transport, false) as has_transport,
  coalesce(agg.has_daycare, false) as has_daycare,
  coalesce(agg.fee_accounts, '[]'::json) as fee_accounts
from student s
join branch b on b.id = s.branch_id
left join (
  select
    fab.student_id,
    count(*) as fee_account_count,
    sum(fab.pending_paise) filter (where fab.status = 'active')
      as total_pending_paise,
    bool_or(
      fab.status = 'active'
      and fab.pending_paise > 0
      and fab.due_date < current_date
    ) as has_overdue,
    bool_or(fab.service_type = 'transport') as has_transport,
    bool_or(fab.service_type = 'daycare') as has_daycare,
    json_agg(
      json_build_object(
        'feeAccountId', fab.fee_account_id,
        'serviceType', fab.service_type,
        'academicYearLabel', ay.label,
        'status', fab.status
      )
      order by fab.service_type, ay.label desc
    ) as fee_accounts
  from fee_account_balance fab
  join academic_year ay on ay.id = fab.academic_year_id
  group by fab.student_id
) agg on agg.student_id = s.id;
