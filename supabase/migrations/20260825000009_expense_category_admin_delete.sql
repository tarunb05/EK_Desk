-- 20260825000007 read "nobody gets delete through the API" on
-- expense_category too literally -- it granted no delete at all, to
-- anyone, and wrote no policy covering delete. But the Phase 10.2 feature
-- itself explicitly wants admin to delete a zero-expense category, with
-- `on delete restrict` as the safety net for one still in use ("that one
-- is safe, and on delete restrict will refuse it if the count was stale,
-- which is the point of having the constraint as well as the check" --
-- a constraint that can never be reached because delete is never
-- attempted isn't a safety net, it's dead code). The real intent, read
-- against every other table's convention in this codebase (student,
-- expense, ...), is "no delete for a non-admin" -- same shape as
-- everywhere else, not "no delete for anyone."
grant delete on expense_category to authenticated;

create policy "admin deletes categories" on expense_category
  for delete to authenticated
  using ((select auth_is_admin()));
