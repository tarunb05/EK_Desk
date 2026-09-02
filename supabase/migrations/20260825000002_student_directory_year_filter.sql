-- Adds a Year filter to the Students list. Deliberately filters which
-- students show up only -- it does NOT re-scope total_pending_paise/
-- has_overdue to that year (those stay lifetime totals, unchanged), which
-- keeps this a small, additive change instead of touching the shared
-- money-aggregation semantics this view and the dashboards both depend on.
-- "All years" (the default, no filter applied) means exactly what it did
-- before this migration.
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
  coalesce(agg.fee_accounts, '[]'::json) as fee_accounts,
  coalesce(agg.academic_year_ids, array[]::uuid[]) as academic_year_ids
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
    ) as fee_accounts,
    array_agg(distinct fab.academic_year_id) as academic_year_ids
  from fee_account_balance fab
  join academic_year ay on ay.id = fab.academic_year_id
  group by fab.student_id
) agg on agg.student_id = s.id;
