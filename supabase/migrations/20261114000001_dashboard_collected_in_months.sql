-- Collected, restricted to payments made in the given months, split by
-- class and by route/slot in one pass. The dashboard's month filter already
-- narrows the "Total collected" tile (via dashboard_collection_by_month);
-- this lets the By class / By route / By slot bars narrow the same way, so a
-- filtered dashboard never shows two different "collected" figures.
--
-- Same scope rules as dashboard_breakdown_by_class / _by_group (active
-- student, active fee account, optional branch) and the same month key as
-- dashboard_collection_by_month (to_char(paid_on, 'YYYY-MM')), so summing
-- this over every month of the year equals their collected_paise.
-- p_months null means "every month".
create or replace function dashboard_collected_by_class_and_group(
  p_service_type text,
  p_academic_year_id uuid,
  p_branch_code text default null,
  p_months text[] default null
)
returns table (
  class_section text,
  group_label text,
  collected_paise bigint
)
language sql
stable
as $$
  select
    far.class_section,
    coalesce(far.route_name, far.slot, 'Unassigned'),
    coalesce(sum(p.amount_paise), 0)::bigint
  from payment p
  join fee_account_record far on far.fee_account_id = p.fee_account_id
  where p.voided_at is null
    and far.service_type = p_service_type
    and far.academic_year_id = p_academic_year_id
    and far.student_status = 'active'
    and far.status = 'active'
    and (p_branch_code is null or far.branch_code = p_branch_code)
    and (p_months is null or to_char(p.paid_on, 'YYYY-MM') = any (p_months))
  group by 1, 2;
$$;

grant execute on function dashboard_collected_by_class_and_group(text, uuid, text, text[]) to authenticated;
