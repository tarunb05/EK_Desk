-- Soft-deleting a student sets student.status = 'inactive'. Every listing
-- and aggregate reads through fee_account_record (CLAUDE.md rule 5), so
-- excluding inactive students there excludes them everywhere at once —
-- except a direct by-id lookup (getFeeAccountRecordById), which stays
-- unfiltered at the app-query layer so an archived student's own history
-- is still viewable, just gone from every dashboard/table/CSV export.

create or replace view fee_account_record
with (security_invoker = true) as
select
  fab.*,
  s.full_name as student_full_name,
  s.admission_no as student_admission_no,
  s.class_section,
  s.guardian_name as student_guardian_name,
  s.phone as student_phone,
  b.id as branch_id,
  b.code as branch_code,
  b.name as branch_name,
  -- Appended at the end: CREATE OR REPLACE VIEW can only add columns after
  -- the existing ones, not reorder them.
  s.status as student_status
from fee_account_balance fab
join student s on s.id = fab.student_id
join branch b on b.id = s.branch_id;

grant select on fee_account_record to authenticated;

create or replace function dashboard_summary(
  p_service_type text,
  p_academic_year_id uuid,
  p_branch_code text default null
)
returns table (
  student_count bigint,
  total_receivable_paise bigint,
  total_collected_paise bigint,
  total_pending_paise bigint,
  total_overdue_paise bigint
)
language sql
stable
as $$
  select
    count(distinct student_id),
    coalesce(sum(total_receivable_paise), 0),
    coalesce(sum(collected_paise), 0),
    coalesce(sum(pending_paise), 0),
    coalesce(
      sum(pending_paise) filter (where pending_paise > 0 and due_date < current_date),
      0
    )
  from fee_account_record
  where service_type = p_service_type
    and academic_year_id = p_academic_year_id
    and student_status = 'active'
    and (p_branch_code is null or branch_code = p_branch_code);
$$;

create or replace function dashboard_ageing_buckets(
  p_service_type text,
  p_academic_year_id uuid,
  p_branch_code text default null
)
returns table (
  bucket text,
  account_count bigint,
  pending_paise bigint
)
language sql
stable
as $$
  select
    case
      when pending_paise <= 0 or due_date >= current_date then 'not_yet_due'
      when current_date - due_date <= 30 then '1-30'
      when current_date - due_date <= 60 then '31-60'
      else '60+'
    end as bucket,
    count(*),
    coalesce(sum(pending_paise), 0)
  from fee_account_record
  where service_type = p_service_type
    and academic_year_id = p_academic_year_id
    and student_status = 'active'
    and (p_branch_code is null or branch_code = p_branch_code)
  group by 1;
$$;

create or replace function dashboard_collection_by_month(
  p_service_type text,
  p_academic_year_id uuid,
  p_branch_code text default null
)
returns table (
  month text,
  collected_paise bigint
)
language sql
stable
as $$
  select
    to_char(p.paid_on, 'YYYY-MM') as month,
    coalesce(sum(p.amount_paise), 0)
  from payment p
  join fee_account_record far on far.fee_account_id = p.fee_account_id
  where p.voided_at is null
    and far.service_type = p_service_type
    and far.academic_year_id = p_academic_year_id
    and far.student_status = 'active'
    and (p_branch_code is null or far.branch_code = p_branch_code)
  group by 1
  order by 1;
$$;

create or replace function dashboard_breakdown_by_class(
  p_service_type text,
  p_academic_year_id uuid,
  p_branch_code text default null
)
returns table (
  class_section text,
  student_count bigint,
  receivable_paise bigint,
  collected_paise bigint,
  pending_paise bigint
)
language sql
stable
as $$
  select
    class_section,
    count(distinct student_id),
    coalesce(sum(total_receivable_paise), 0),
    coalesce(sum(collected_paise), 0),
    coalesce(sum(pending_paise), 0)
  from fee_account_record
  where service_type = p_service_type
    and academic_year_id = p_academic_year_id
    and student_status = 'active'
    and (p_branch_code is null or branch_code = p_branch_code)
  group by class_section
  order by class_section;
$$;

create or replace function dashboard_breakdown_by_group(
  p_service_type text,
  p_academic_year_id uuid,
  p_branch_code text default null
)
returns table (
  group_label text,
  student_count bigint,
  receivable_paise bigint,
  collected_paise bigint,
  pending_paise bigint
)
language sql
stable
as $$
  select
    coalesce(route_name, slot, 'Unassigned'),
    count(distinct student_id),
    coalesce(sum(total_receivable_paise), 0),
    coalesce(sum(collected_paise), 0),
    coalesce(sum(pending_paise), 0)
  from fee_account_record
  where service_type = p_service_type
    and academic_year_id = p_academic_year_id
    and student_status = 'active'
    and (p_branch_code is null or branch_code = p_branch_code)
  group by 1
  order by 1;
$$;
