-- Phase 10.4 (scoped) -- total expenses + category breakdown chart on
-- /expenses. Plain/invoker function, same convention as dashboard_summary
-- and friends (20260821000007) -- not security definer, RLS on expense
-- already scopes a teacher to their own branch transparently regardless
-- of what p_branch_code is passed, same as every existing dashboard RPC.
--
-- Inner joins throughout (not left join from expense_category) --
-- a category with nothing spent in this year/branch isn't part of a
-- breakdown of what was actually spent, so it simply doesn't appear.
create function expense_category_breakdown(
  p_academic_year_id uuid,
  p_branch_code text default null
)
returns table (
  category_id uuid,
  category_name text,
  amount_paise bigint
)
language sql
stable
as $$
  select ec.id, ec.name, sum(e.amount_paise)
  from expense e
  join expense_category ec on ec.id = e.category_id
  join branch b on b.id = e.branch_id
  where e.academic_year_id = p_academic_year_id
    and (p_branch_code is null or b.code = p_branch_code)
  group by ec.id, ec.name
  order by sum(e.amount_paise) desc;
$$;

grant execute on function expense_category_breakdown(uuid, text) to authenticated;
