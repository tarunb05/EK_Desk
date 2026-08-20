-- Supabase's own stack pre-creates anon/authenticated/service_role before
-- user migrations run. A plain Postgres (e.g. a CI service container) does
-- not, so the GRANTs in the RLS migration would fail there. Creating them
-- here, idempotently, keeps "migrations apply cleanly from empty" true on
-- both a bare Postgres and the full Supabase stack.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;
