-- Backs the cross-service /students directory. A student's payment status
-- there isn't scoped to one service (unlike the transport/daycare record
-- tables) — it's an aggregate over every fee_account they have, across
-- both services and every academic year, so it needs its own view rather
-- than reusing fee_account_record as-is. fee_accounts is a json array of
-- every fee_account the student has ({feeAccountId, serviceType,
-- academicYearLabel}) so the directory can render Edit/Record-payment
-- links per account without an N+1 query per row — the year label is
-- included so a student with the same service across two years (a
-- continuing enrollment) gets two distinguishable rows, not two identical
-- unlabelled ones.
create view student_directory
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
    sum(fab.pending_paise) as total_pending_paise,
    bool_or(fab.pending_paise > 0 and fab.due_date < current_date)
      as has_overdue,
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
