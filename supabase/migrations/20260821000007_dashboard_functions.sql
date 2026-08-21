-- Dashboard aggregation, computed in Postgres rather than by fetching rows
-- into the app tier. Every function takes the same three scope params
-- (service_type, academic_year_id, branch_code — null branch_code means
-- "all branches") and reads fee_account_record, so transport and daycare
-- call the exact same functions with a different service_type.

create function dashboard_summary(
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
    and (p_branch_code is null or branch_code = p_branch_code);
$$;

-- Bucket boundaries mirror src/lib/domain/overdue.ts exactly (1-30, 31-60,
-- 60+ days overdue); an integration test asserts they agree on seeded data.
create function dashboard_ageing_buckets(
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
    and (p_branch_code is null or branch_code = p_branch_code)
  group by 1;
$$;

create function dashboard_collection_by_month(
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
    and (p_branch_code is null or far.branch_code = p_branch_code)
  group by 1
  order by 1;
$$;

create function dashboard_breakdown_by_class(
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
    and (p_branch_code is null or branch_code = p_branch_code)
  group by class_section
  order by class_section;
$$;

-- route_name (transport) and slot (daycare) are mutually exclusive per the
-- fee_account_service_columns CHECK, so one grouping expression covers both.
create function dashboard_breakdown_by_group(
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
    and (p_branch_code is null or branch_code = p_branch_code)
  group by 1
  order by 1;
$$;

grant execute on function dashboard_summary(text, uuid, text) to authenticated;
grant execute on function dashboard_ageing_buckets(text, uuid, text) to authenticated;
grant execute on function dashboard_collection_by_month(text, uuid, text) to authenticated;
grant execute on function dashboard_breakdown_by_class(text, uuid, text) to authenticated;
grant execute on function dashboard_breakdown_by_group(text, uuid, text) to authenticated;
