-- A teacher-to-admin help channel, independent of the approval queue --
-- "I can't figure out X" isn't a record proposing a change to student/fee
-- data, so it doesn't belong in student_submission/etc., and it isn't one
-- of the seven tables activity_log covers (domain model rule 12's list is
-- deliberately closed), so this stays its own table with no log trigger.

create table support_request (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branch (id),
  submitted_by uuid not null references profile (id),
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references profile (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint support_request_resolved_matches_status check (
    (status = 'open') = (resolved_by is null and resolved_at is null)
  )
);

create index support_request_status on support_request (status, created_at);

alter table support_request enable row level security;

grant select, insert, update on support_request to authenticated;

create policy "admin full access" on support_request
  for all to authenticated
  using ((select auth_is_admin()))
  with check ((select auth_is_admin()));

create policy "teacher inserts for own branch" on support_request
  for insert to authenticated
  with check (
    (select auth_role()) = 'teacher'
    and submitted_by = (select auth.uid())
    and branch_id = (select auth_branch_id())
  );

create policy "teacher reads own requests" on support_request
  for select to authenticated
  using (
    (select auth_role()) = 'teacher'
    and submitted_by = (select auth.uid())
  );
