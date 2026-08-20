-- pending is never stored: this view derives it from payments every read.
-- security_invoker makes the view run with the querying user's RLS, not the
-- view owner's, so it can't become a back door around the policies below.
create view fee_account_balance
with (security_invoker = true) as
select
  fa.id as fee_account_id,
  fa.student_id,
  fa.academic_year_id,
  fa.service_type,
  fa.total_receivable_paise,
  fa.due_date,
  fa.starts_on,
  fa.ends_on,
  fa.status,
  fa.route_name,
  fa.pickup_point,
  fa.slot,
  coalesce(sum(p.amount_paise) filter (where p.voided_at is null), 0)::bigint
    as collected_paise,
  fa.total_receivable_paise
    - coalesce(sum(p.amount_paise) filter (where p.voided_at is null), 0)::bigint
    as pending_paise,
  max(p.paid_on) filter (where p.voided_at is null) as last_paid_on
from fee_account fa
left join payment p on p.fee_account_id = fa.id
group by fa.id;
