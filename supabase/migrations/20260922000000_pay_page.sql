-- Phase 15.4: the public pay page's backend -- rate-limited lookup, claim
-- submission. The first genuinely unauthenticated read *and* write in this
-- app, so both go through security definer functions with their own
-- narrow, explicit checks rather than any table grant to anon.

-- Hardening payment_claim.utr (15.1) now that it's reachable from an
-- anonymous caller: a real UTR/bank reference is well under this, and the
-- application layer (submitPaymentClaimSchema) already caps it too -- this
-- is the backstop for anything that ever calls submit_payment_claim
-- directly, bypassing the Zod layer.
alter table payment_claim
  add constraint payment_claim_utr_length check (char_length(utr) <= 50);

-- Rate limiting: no Redis/Upstash in this stack, and this is too narrow a
-- need to add one for (CLAUDE.md: no new dependency without asking). A
-- plain table, checked and written inside the same security definer
-- function call it's guarding -- same query-based approach already used
-- for admin request-creation in 15.3. ip_hash is sha256(ip) computed in
-- Node before this table ever sees it (src/lib/payments/actions.ts /
-- the pay page itself) -- same reasoning as the payment token being
-- hash-only: this table has no legitimate reason to ever hold a real IP.
create table pay_page_activity (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: an unknown/garbage token hash still needs counting against
  -- its own IP (a brute-force attempt across many fake tokens), even
  -- though there's no real payment_request row to associate it with.
  token_hash bytea,
  ip_hash bytea not null,
  event_type text not null check (event_type in ('view', 'claim')),
  created_at timestamptz not null default now()
);

create index pay_page_activity_by_ip
  on pay_page_activity (ip_hash, event_type, created_at);
create index pay_page_activity_by_token
  on pay_page_activity (token_hash, event_type, created_at)
  where token_hash is not null;

alter table pay_page_activity enable row level security;
-- No grants to anon or authenticated at all -- every access to this table
-- goes through the security definer functions below.

-- Replaces 15.1's version (never called by anything yet, so no
-- compatibility concern) -- same columns, but now plpgsql so it can also
-- check and record rate-limit activity in the same call. Unknown,
-- expired, closed, cancelled, and rate-limited all return zero rows here,
-- deliberately indistinguishable to the caller (brief: the page can't be
-- used to tell which tokens once existed).
drop function lookup_payment_request_by_token_hash(bytea);

create function lookup_payment_request_by_token_hash(
  p_token_hash bytea,
  p_ip_hash bytea
)
returns table (
  branch_name text,
  service_type text,
  child_first_name text,
  amount_paise bigint,
  expires_at timestamptz,
  reference_code text,
  payee_name text,
  upi_id text,
  include_upi boolean,
  include_bank boolean,
  bank_name text,
  account_holder text,
  account_number text,
  ifsc text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_views integer;
  v_ip_views integer;
begin
  -- Cheap, low-frequency opportunistic prune -- this app has no cron
  -- infrastructure yet, so unbounded growth is kept in check inline
  -- instead, at a cost most calls never pay.
  if random() < 0.01 then
    delete from pay_page_activity where created_at < now() - interval '7 days';
  end if;

  select count(*) into v_token_views
  from pay_page_activity
  where token_hash = p_token_hash
    and event_type = 'view'
    and created_at > now() - interval '10 minutes';

  select count(*) into v_ip_views
  from pay_page_activity
  where ip_hash = p_ip_hash
    and event_type = 'view'
    and created_at > now() - interval '10 minutes';

  -- 30/token and 60/IP per 10 minutes: generous for a parent reloading or
  -- re-sharing the same link, tight against a script enumerating many
  -- tokens from one IP or hammering one token. Returns empty immediately,
  -- same shape as "not found" -- no join, no activity row logged for this
  -- attempt (it's already over the limit; logging it doesn't change the
  -- decision and only grows the table faster under actual abuse).
  if v_token_views >= 30 or v_ip_views >= 60 then
    return;
  end if;

  insert into pay_page_activity (token_hash, ip_hash, event_type)
  values (p_token_hash, p_ip_hash, 'view');

  return query
  select
    b.name as branch_name,
    fa.service_type,
    split_part(s.full_name, ' ', 1) as child_first_name,
    pr.amount_paise,
    pr.expires_at,
    pr.reference_code,
    ca.payee_name,
    ca.upi_id,
    pr.include_upi,
    pr.include_bank,
    ca.bank_name,
    ca.account_holder,
    ca.account_number,
    ca.ifsc,
    pr.status
  from payment_request pr
  join fee_account fa on fa.id = pr.fee_account_id
  join student s on s.id = fa.student_id
  join branch b on b.id = s.branch_id
  join collection_account ca on ca.id = pr.collection_account_id
  where pr.token_hash = p_token_hash;
end;
$$;

grant execute on function lookup_payment_request_by_token_hash(bytea, bytea) to anon;
grant execute on function lookup_payment_request_by_token_hash(bytea, bytea) to authenticated;

-- The claim form's one write. p_utr arrives already normalized (trim,
-- strip spaces, uppercase) -- src/lib/domain/utr.ts, a pure function, not
-- SQL's job. Requires status = 'open' server-side regardless of what the
-- page rendered (the page only shows the form for an open request, but
-- this never trusts that client-side -- the token could be replayed after
-- the request closed between page load and submit).
create function submit_payment_claim(
  p_token_hash bytea,
  p_ip_hash bytea,
  p_utr text,
  p_amount_paise bigint,
  p_paid_on date,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_status text;
  v_created_at timestamptz;
  v_token_claims integer;
  v_ip_claims integer;
  v_pending_claims integer;
begin
  select id, status, created_at into v_request_id, v_status, v_created_at
  from payment_request where token_hash = p_token_hash;

  if not found or v_status <> 'open' then
    raise exception 'this request is not open';
  end if;

  if p_amount_paise <= 0 then
    raise exception 'invalid amount';
  end if;
  if p_paid_on > current_date or p_paid_on < v_created_at::date then
    raise exception 'invalid date';
  end if;

  select count(*) into v_token_claims
  from pay_page_activity
  where token_hash = p_token_hash
    and event_type = 'claim'
    and created_at > now() - interval '1 hour';

  select count(*) into v_ip_claims
  from pay_page_activity
  where ip_hash = p_ip_hash
    and event_type = 'claim'
    and created_at > now() - interval '1 hour';

  -- 5/token and 10/IP per hour: room for an honest retry after a typo,
  -- not for scripted spam.
  if v_token_claims >= 5 or v_ip_claims >= 10 then
    raise exception 'too many attempts';
  end if;

  select count(*) into v_pending_claims
  from payment_claim
  where payment_request_id = v_request_id and status = 'pending';

  if v_pending_claims >= 3 then
    raise exception 'too many pending claims';
  end if;

  insert into payment_claim
    (payment_request_id, source, utr, claimed_amount_paise, claimed_paid_on)
  values
    (v_request_id, p_source, p_utr, p_amount_paise, p_paid_on);

  insert into pay_page_activity (token_hash, ip_hash, event_type)
  values (p_token_hash, p_ip_hash, 'claim');
end;
$$;

grant execute on function submit_payment_claim(
  bytea, bytea, text, bigint, date, text
) to anon;
grant execute on function submit_payment_claim(
  bytea, bytea, text, bigint, date, text
) to authenticated;
