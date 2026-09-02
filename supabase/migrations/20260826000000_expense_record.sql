-- Phase 10.3 -- the /expenses list needs names, not ids (category, branch,
-- who entered/edited it) and an "edited" signal. security_invoker = true is
-- what makes a teacher's read of this view automatically inherit the same
-- own-branch-only RLS `expense` already enforces -- unlike
-- expense_category_summary (10.2, admin-only route, deliberately not
-- invoker-scoped), this view is read by both roles.
create view expense_record
  with (security_invoker = true) as
select
  e.id,
  e.branch_id,
  b.code as branch_code,
  b.name as branch_name,
  e.academic_year_id,
  e.category_id,
  ec.name as category_name,
  e.amount_paise,
  e.spent_on,
  e.method,
  e.reference,
  e.note,
  e.created_by,
  creator.full_name as created_by_name,
  e.updated_by,
  updater.full_name as updated_by_name,
  e.created_at,
  e.updated_at
from expense e
join branch b on b.id = e.branch_id
join expense_category ec on ec.id = e.category_id
join profile creator on creator.id = e.created_by
left join profile updater on updater.id = e.updated_by;

grant select on expense_record to authenticated;
