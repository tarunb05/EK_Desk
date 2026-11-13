-- The Expenses page's "Total expenses" card and category chart now follow the
-- same filters as the list below them (branch, category, method, calendar
-- year / month / date range, search). The breakdown function only took an
-- academic year and a branch, so it can't apply the rest; this replaces it
-- with a version that takes them all as optional arguments. The year and
-- month filters arrive as one date range (p_from / p_to), so the academic
-- year argument goes -- an expense is found by the date it was spent.
-- Aggregation stays in Postgres, and the card total is still the sum of this
-- function's rows (CLAUDE.md rule 11: an expense-only aggregate, never folded
-- into a fee query).
--
-- No expense rows are read or changed by this migration -- it only swaps one
-- function. The old (uuid, text) signature is dropped first: leaving it next
-- to the new one would make a call with just those two arguments ambiguous
-- to PostgREST.
--
-- Filter semantics deliberately mirror the list (expense-directory.ts):
-- null means "no filter", and the search is the same case-insensitive
-- substring match over category name, reference and note, with % and _ left
-- as wildcards exactly as the list's ilike treats them, so the card and the
-- table can't disagree about which rows match.
drop function expense_category_breakdown(uuid, text);

create function expense_category_breakdown(
  p_branch_code text default null,
  p_category_id uuid default null,
  p_method text default null,
  p_from date default null,
  p_to date default null,
  p_q text default null
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
  where (p_branch_code is null or b.code = p_branch_code)
    and (p_category_id is null or e.category_id = p_category_id)
    and (p_method is null or e.method = p_method)
    and (p_from is null or e.spent_on >= p_from)
    and (p_to is null or e.spent_on <= p_to)
    and (
      p_q is null
      or ec.name ilike '%' || p_q || '%'
      or e.reference ilike '%' || p_q || '%'
      or e.note ilike '%' || p_q || '%'
    )
  group by ec.id, ec.name
  order by sum(e.amount_paise) desc;
$$;

grant execute on function expense_category_breakdown(text, uuid, text, date, date, text)
  to authenticated;
