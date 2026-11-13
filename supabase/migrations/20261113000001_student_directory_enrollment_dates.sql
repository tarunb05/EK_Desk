-- The Students list's single Actions menu lets you pick which enrollment an
-- option applies to, and a student can now have several stints in one year,
-- so "Daycare (2026-27)" no longer tells them apart. Each fee_accounts entry
-- gains startsOn / endsOn so the menu can label a stint by its dates.
--
-- Identical to the view in 20260923000000_verify_claims.sql except for those
-- two JSON keys and a stable order within a service (newest stint first).
-- The view's columns don't change, only what's inside the fee_accounts JSON,
-- and no rows are touched.
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
        'startsOn', fab.starts_on,
        'endsOn', fab.ends_on,
        'status', fab.status,
        'paymentRequestStatus', case
          when pr.id is null then 'none'
          when exists (
            select 1 from payment_claim pc
            where pc.payment_request_id = pr.id and pc.status = 'pending'
          ) then 'reported'
          else 'open'
        end
      )
      order by fab.service_type, fab.starts_on desc, ay.label desc
    ) as fee_accounts,
    array_agg(distinct fab.academic_year_id) as academic_year_ids
  from fee_account_balance fab
  join academic_year ay on ay.id = fab.academic_year_id
  left join payment_request pr
    on pr.fee_account_id = fab.fee_account_id and pr.status = 'open'
  group by fab.student_id
) agg on agg.student_id = s.id;
