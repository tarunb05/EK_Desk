-- Discontinuing a fee account (fee_account.status = 'discontinued') means
-- the school has stopped billing that enrollment — its receivable/pending
-- should stop counting toward current figures immediately, the same way an
-- archived student already does. Unlike an archived student, a
-- discontinued fee account's own history (payments, the account's edit/
-- detail pages) stays fully visible — only the aggregates below change.
-- Every dashboard aggregate already filters student_status = 'active';
-- this adds the equivalent status = 'active' filter on the fee_account
-- itself, on the same columns fee_account_record already exposes.

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
    and status = 'active'
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
    and status = 'active'
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
    and far.status = 'active'
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
    and status = 'active'
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
    and status = 'active'
    and (p_branch_code is null or branch_code = p_branch_code)
  group by 1
  order by 1;
$$;

-- student_directory's payment-status classification (used by the /students
-- pending/overdue/paid filter) should reflect the same "current standing"
-- principle: a discontinued account's pending balance stops counting, but
-- fee_account_count and the fee_accounts list stay comprehensive (active +
-- discontinued) so staff can still navigate to a discontinued account's own
-- history from the directory row.
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
        'academicYearLabel', ay.label
      )
      order by fab.service_type, ay.label desc
    ) as fee_accounts
  from fee_account_balance fab
  join academic_year ay on ay.id = fab.academic_year_id
  group by fab.student_id
) agg on agg.student_id = s.id;

grant select on student_directory to authenticated;
