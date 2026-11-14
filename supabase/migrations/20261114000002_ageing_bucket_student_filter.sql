-- Clicking a row of the dashboard's "How old the pending is" chart opens the
-- Students list narrowed to exactly the accounts that row counts. For the
-- list and the chart to agree, both have to sort an account into a bucket
-- the same way, so the rule moves into one function and both use it.

-- Which ageing bucket a fee account is in today. Unchanged from the CASE
-- dashboard_ageing_buckets has carried since 20260821000007: nothing
-- pending, or not due yet, is 'not_yet_due'; otherwise by days past due.
create or replace function fee_ageing_bucket(
  p_pending_paise bigint,
  p_due_date date
)
returns text
language sql
stable
as $$
  select case
    when p_pending_paise <= 0 or p_due_date >= current_date then 'not_yet_due'
    when current_date - p_due_date <= 30 then '1-30'
    when current_date - p_due_date <= 60 then '31-60'
    else '60+'
  end;
$$;

grant execute on function fee_ageing_bucket(bigint, date) to authenticated;

-- Same signature, same result; now reads the bucket from fee_ageing_bucket.
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
    fee_ageing_bucket(pending_paise, due_date) as bucket,
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

-- The Students list rows behind one bucket of that chart: every student
-- with at least one account the chart counts in p_bucket (same service,
-- year, branch and active-only rules). Returns student_directory rows so
-- the list's own search, filters, sort and paging chain on unchanged.
-- security invoker like everything it reads, so a teacher still only gets
-- their own branch.
create or replace function students_in_ageing_bucket(
  p_service_type text,
  p_academic_year_id uuid,
  p_bucket text,
  p_branch_code text default null
)
returns setof student_directory
language sql
stable
as $$
  select sd.*
  from student_directory sd
  where sd.id in (
    select far.student_id
    from fee_account_record far
    where far.service_type = p_service_type
      and far.academic_year_id = p_academic_year_id
      and far.student_status = 'active'
      and far.status = 'active'
      and (p_branch_code is null or far.branch_code = p_branch_code)
      and fee_ageing_bucket(far.pending_paise, far.due_date) = p_bucket
  );
$$;

grant execute on function students_in_ageing_bucket(text, uuid, text, text) to authenticated;
