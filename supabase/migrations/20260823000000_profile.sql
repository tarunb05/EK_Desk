-- Mirrors 20260821000000_roles.sql's approach: a bare Postgres (CI's
-- service-container test job) has none of Supabase's auth schema, but the
-- full Supabase stack (local dev, staging, prod) already has all of it --
-- these guards keep "migrations apply cleanly from empty" true on both,
-- the same property that migration already established for
-- anon/authenticated/service_role. Nothing here runs on a real Supabase
-- stack, since auth.users/auth.uid() already exist there.
do $$
begin
  if not exists (select from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;

  if not exists (
    select from pg_tables where schemaname = 'auth' and tablename = 'users'
  ) then
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
  end if;

  if not exists (
    select from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid() returns uuid
    language sql stable
    as $fn$
      select
        coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
    $fn$;
  end if;
end
$$;

-- One row per auth user. role/branch_id are nullable at first so the
-- backfill below can populate the existing admin user(s) before the
-- not-null constraint on role is added -- nobody gets locked out mid-migration.
create table profile (
  id uuid primary key references auth.users (id) on delete cascade,
  role text check (role in ('admin', 'teacher')),
  branch_id uuid references branch (id),
  full_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_teacher_requires_branch
    check (role <> 'teacher' or branch_id is not null)
);

-- Every auth user that exists before this migration is the shared admin
-- login from Phase 7 -- backfill them as admin so existing sign-ins keep
-- working once RLS starts reading this table.
insert into profile (id, role, full_name)
select id, 'admin', coalesce(raw_user_meta_data ->> 'full_name', 'Admin')
from auth.users;

alter table profile alter column role set not null;
