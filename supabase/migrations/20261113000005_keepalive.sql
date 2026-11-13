-- A query a scheduled job can run so the hosted project always has recent
-- database activity. Supabase pauses a free-plan project after about a week
-- with none, and a paused project takes the whole app down until someone
-- restores it by hand.
--
-- It reads nothing and writes nothing (so it can't touch the activity log or
-- any student data) and returns a constant, which is why it is safe to leave
-- callable by anyone with the public anon key: there is nothing in it to
-- learn or misuse. Security invoker, so it runs with the caller's own rights
-- and gains no extra access.
create function keepalive()
returns int
language sql
stable
security invoker
as $$ select 1 $$;

grant execute on function keepalive() to anon, authenticated;
