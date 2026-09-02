-- Phase 10.2 -- the Expense categories settings screen needs a per-category
-- expense count and total-spent figure. One aggregate query via a view,
-- matching the fee_account_balance/student_directory pattern, instead of
-- N+1 queries per row.
--
-- security_invoker is safe here even though this is an aggregate: the only
-- caller is the admin-only /settings/expense-categories route, and an
-- admin's own RLS already grants full cross-branch `expense` access -- so
-- the aggregate an admin sees is always the true global figure, never
-- silently clipped to one branch the way it would be if a teacher could
-- reach this view (they can't; the route is admin-only).
create view expense_category_summary
  with (security_invoker = true) as
select
  ec.id,
  ec.name,
  ec.is_active,
  ec.sort_order,
  count(e.id) as expense_count,
  coalesce(sum(e.amount_paise), 0) as total_spent_paise
from expense_category ec
left join expense e on e.category_id = ec.id
group by ec.id;

grant select on expense_category_summary to authenticated;
