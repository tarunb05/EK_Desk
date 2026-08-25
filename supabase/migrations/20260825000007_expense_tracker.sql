-- Phase 10.1 -- expense tracker, schema and authorization only. No
-- user-facing feature yet: recording/editing/deleting an expense, the
-- dashboard, and the security-definer delete function all come later.
-- See CLAUDE.md rules 8-11 for the reasoning behind why `expense` is
-- mutable (unlike append-only `payment`), why a teacher's write needs no
-- approval queue, and why the teacher-money-blackout has exactly this one
-- exception.

create table expense_category (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Grocery" and "grocery" are the same category and the office will type
-- both -- case-insensitive dedup via an expression index rather than a
-- plain unique constraint.
create unique index expense_category_unique_name
  on expense_category (lower(name));

create table expense (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branch (id),
  academic_year_id uuid not null references academic_year (id),
  -- A used category is never deleted, only deactivated (is_active =
  -- false) -- on delete restrict is the database-level guarantee that
  -- backs that up even if the application layer ever forgets to check.
  category_id uuid not null references expense_category (id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  -- "Not in the future" and "within the referenced academic year" are
  -- both real rules, but neither can be a CHECK constraint here:
  -- current_date isn't immutable (Postgres won't allow it in a CHECK),
  -- and academic-year containment needs a lookup into a different table,
  -- which CHECK can't do either. Both are enforced in the Server Action
  -- instead (Phase 10.3), the future check freshly and the containment
  -- check via the existing isWithinAcademicYear in
  -- src/lib/domain/academic-year.ts.
  spent_on date not null,
  method text not null check (method in ('cash', 'upi', 'cheque', 'bank_transfer')),
  reference text,
  note text,
  created_by uuid not null references profile (id),
  updated_by uuid references profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expense_branch_spent_on on expense (branch_id, spent_on desc);
create index expense_year_branch_spent_on on expense (academic_year_id, branch_id, spent_on);
create index expense_category_id on expense (category_id);
create index expense_created_by on expense (created_by);

alter table expense_category enable row level security;
alter table expense enable row level security;

-- expense_category: every authenticated user may read (a teacher's entry
-- form needs the list); only admin may insert/update. Nobody gets delete
-- through the API at all -- deactivation is the only removal path, and
-- on delete restrict above is the second net.
grant select on expense_category to authenticated;
grant insert, update on expense_category to authenticated;

create policy "read access" on expense_category
  for select to authenticated
  using (true);

create policy "admin inserts categories" on expense_category
  for insert to authenticated
  with check ((select auth_is_admin()));

create policy "admin updates categories" on expense_category
  for update to authenticated
  using ((select auth_is_admin()))
  with check ((select auth_is_admin()));

-- expense: admin full access. Teacher gets select/insert/update scoped to
-- their own branch, no delete grant at all -- same "no grant, not just a
-- false policy" pattern as the Phase 9.4 student hard-delete. A teacher's
-- own-branch check is wrapped in (select ...) per the newer RLS
-- performance convention this repo's most recent migrations adopted
-- (evaluated once via InitPlan, not once per row).
grant select, insert, update, delete on expense to authenticated;

create policy "admin full access" on expense
  for all to authenticated
  using ((select auth_is_admin()))
  with check ((select auth_is_admin()));

create policy "teacher reads own branch" on expense
  for select to authenticated
  using (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
  );

-- created_by is pinned to the caller, not trusted from the client -- a
-- teacher inserting on someone else's behalf isn't a case this app has.
create policy "teacher inserts own branch" on expense
  for insert to authenticated
  with check (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
    and created_by = (select auth.uid())
  );

-- with check re-applies the same branch condition, so a teacher can edit
-- any field on a row in their branch but can never move it to another
-- branch -- the row must still belong to their branch after the update.
create policy "teacher updates own branch" on expense
  for update to authenticated
  using (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
  )
  with check (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
  );
