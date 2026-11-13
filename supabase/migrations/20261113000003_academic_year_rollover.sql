-- Academic years roll over by themselves. Until now a new year (2027-28) only
-- existed once someone added it in Settings and flagged it current, and every
-- selector in the app (top bar, filters, the add-student form) read from that
-- table. This function does both, and a daily pg_cron job calls it, so on 1
-- April the new year appears and becomes current with nobody doing anything.
--
-- What it does, for the Indian academic year (1 April - 31 March):
--   1. Makes sure a row exists for the year containing today, labelled like
--      the existing ones ('2027-28'). Existing rows are never touched.
--   2. If the year flagged current has ended (or none is flagged), flags the
--      year containing today instead. A current year that is still running
--      is left alone, so choosing a different year by hand in Settings isn't
--      undone the next morning.
--
-- Safe to run any number of times (the job runs daily, so a missed run heals
-- itself), and it takes the date as an argument so it can be tested without
-- waiting for April.
--
-- pg_cron is only on Supabase's own Postgres. A plain Postgres (the CI
-- service container) doesn't have it, so scheduling below is conditional:
-- the function always exists, the daily job exists wherever pg_cron does.

create function roll_academic_year(
  p_today date default (now() at time zone 'Asia/Kolkata')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_year int;
  v_start date;
  v_label text;
  v_year_id uuid;
begin
  -- April-December belong to the year starting this calendar year,
  -- January-March to the one that started the year before.
  v_start_year := extract(year from p_today)::int
    - case when extract(month from p_today) < 4 then 1 else 0 end;
  v_start := make_date(v_start_year, 4, 1);
  v_label := v_start_year::text || '-' || lpad(((v_start_year + 1) % 100)::text, 2, '0');

  select id into v_year_id
  from academic_year
  where starts_on <= p_today and ends_on >= p_today
  order by starts_on desc
  limit 1;

  if v_year_id is null then
    insert into academic_year (label, starts_on, ends_on, is_current)
    values (v_label, v_start, make_date(v_start_year + 1, 3, 31), false)
    on conflict do nothing
    returning id into v_year_id;

    -- A row with this label already existed (with different dates): leave it
    -- alone rather than guess, and don't change which year is current.
    if v_year_id is null then
      return;
    end if;
  end if;

  if not exists (
    select 1 from academic_year where is_current and ends_on >= p_today
  ) then
    -- The partial unique index allows only one current year, so clear first.
    update academic_year set is_current = false where is_current;
    update academic_year set is_current = true where id = v_year_id;
  end if;
end;
$$;

-- Not callable from the app: only the job (running as the database owner)
-- and migrations use it.
revoke all on function roll_academic_year(date) from public, anon, authenticated;

-- 18:35 UTC is 00:05 in India, shortly after midnight on the new day.
-- Scheduling by name replaces the job if this migration is ever re-applied.
do $schedule$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'roll-academic-year',
      '35 18 * * *',
      'select roll_academic_year()'
    );
  else
    raise notice 'pg_cron is not available; roll_academic_year() is not scheduled';
  end if;
end;
$schedule$;

-- Catch up right away in case the migration lands after a year has begun.
select roll_academic_year();
