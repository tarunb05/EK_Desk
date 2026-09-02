-- Phase 10.3 gave expense "hard-deleted directly... with a server-side
-- edit/delete log (actor, expense id, category id, amount, timestamp — no
-- free text) as the only audit trail" per CLAUDE.md rule 8, but the delete
-- side was never actually wired up: no teacher delete policy, and no log
-- table at all. Admin already has delete via "admin full access" (for
-- all); this adds the matching teacher-own-branch delete policy (same
-- shape as "teacher updates own branch") and the log table itself.

create policy "teacher deletes own branch" on expense
  for delete to authenticated
  using (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
  );

-- Not a FK to expense: the whole point is this row survives after the
-- expense it describes is gone. category_id can stay a real FK, since
-- expense_category is never hard-deleted, only deactivated (on delete
-- restrict already guarantees that at the schema level).
create table expense_delete_log (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  category_id uuid not null references expense_category (id),
  amount_paise bigint not null,
  actor uuid not null references profile (id),
  created_at timestamptz not null default now()
);

create index expense_delete_log_expense_id on expense_delete_log (expense_id);

alter table expense_delete_log enable row level security;

grant select, insert on expense_delete_log to authenticated;

-- Admin reads every entry (there's no UI for this yet, but the table is
-- the audit trail itself, per CLAUDE.md rule 8 -- readable is the point).
create policy "admin reads delete log" on expense_delete_log
  for select to authenticated
  using ((select auth_is_admin()));

-- actor is pinned to the caller, not trusted from the client, same
-- convention as expense's own "teacher inserts own branch" policy --
-- anyone deleting an expense they were already allowed to delete may log
-- that they did it, but only as themselves.
create policy "logs its own actor" on expense_delete_log
  for insert to authenticated
  with check (actor = (select auth.uid()));
