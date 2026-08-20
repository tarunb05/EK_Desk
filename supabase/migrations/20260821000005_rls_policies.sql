-- Default-deny RLS. The anon key gets no grants at all, so it can't read or
-- write anything regardless of policies. Authenticated users get full
-- access for now via `using (true)` / `with check (true)` policies -- when
-- per-branch roles are introduced later, each `true` here is replaced by a
-- branch-membership check, which is a policy change, not a schema change.
-- No table gets a DELETE policy: records are discontinued via status
-- columns, never removed, and payment additionally forbids it via the
-- append-only trigger.

alter table branch enable row level security;
alter table academic_year enable row level security;
alter table student enable row level security;
alter table fee_account enable row level security;
alter table payment enable row level security;

grant select, insert, update on branch to authenticated;
grant select, insert, update on academic_year to authenticated;
grant select, insert, update on student to authenticated;
grant select, insert, update on fee_account to authenticated;
grant select, insert, update on payment to authenticated;
grant select on fee_account_balance to authenticated;

create policy "authenticated full access" on branch
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on academic_year
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on student
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on fee_account
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on payment
  for all to authenticated using (true) with check (true);
