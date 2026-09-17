-- Phase 15.3: creating and sharing a payment request, and the three
-- remaining auto-close triggers the brief lists (a payment clearing
-- pending, a fee account going discontinued, its receivable dropping below
-- an open request's amount). 15.2 already handles the fourth (a collection
-- account's own details changing).

-- 'fee_account_changed' -- the fee account itself changed under the
-- request (discontinued, or its receivable lowered below what's still
-- owed) -- distinct from 'account_changed' (the *collection* account's
-- UPI/bank details, Phase 15.2) and from 'pending_cleared' (which
-- specifically means the debt was paid off; the debt can still be well
-- above zero here, only the request's own amount is no longer valid
-- against it). Not in the brief's own suggested closed_reason list, which
-- has no value for this case.
alter table payment_request drop constraint payment_request_closed_reason_check;
alter table payment_request add constraint payment_request_closed_reason_check
  check (closed_reason in (
    'paid', 'pending_cleared', 'expired', 'cancelled',
    'account_changed', 'fee_account_changed'
  ));

-- Auto-close via triggers, not scattered Server Action hooks: a payment or
-- a fee-account status/receivable change can arrive through the admin's
-- direct action OR a teacher's submission approved later in pure SQL
-- (approve_payment_submission / approve_student_edit) -- hooking this into
-- every TypeScript action would silently miss the approval-path functions,
-- which never call back into Node. Same shape as log_activity()'s own
-- triggers (CLAUDE.md rule 12): security definer so they see past RLS and
-- fire regardless of which path wrote the row.
create function close_requests_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending bigint;
begin
  select pending_paise into v_pending
  from fee_account_balance
  where fee_account_id = new.fee_account_id;

  if v_pending <= 0 then
    update payment_request
    set status = 'closed', closed_reason = 'pending_cleared', updated_at = now()
    where fee_account_id = new.fee_account_id and status = 'open';
  end if;

  return new;
end;
$$;

create trigger close_requests_after_payment_insert
  after insert on payment
  for each row execute function close_requests_on_payment();

create function close_requests_on_fee_account_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending bigint;
begin
  if new.status = 'discontinued' and old.status <> 'discontinued' then
    update payment_request
    set status = 'cancelled', closed_reason = 'fee_account_changed', updated_at = now()
    where fee_account_id = new.id and status = 'open';
    return new;
  end if;

  if new.total_receivable_paise < old.total_receivable_paise then
    select pending_paise into v_pending
    from fee_account_balance where fee_account_id = new.id;

    update payment_request
    set status = 'cancelled', closed_reason = 'fee_account_changed', updated_at = now()
    where fee_account_id = new.id and status = 'open' and amount_paise > v_pending;
  end if;

  return new;
end;
$$;

create trigger close_requests_after_fee_account_update
  after update on fee_account
  for each row execute function close_requests_on_fee_account_change();

-- Create/share: one function, one transaction (same shape as
-- save_collection_account) -- validates against the real pending figure
-- and the real collection account (never trusts a client-supplied
-- pending), cancels an existing open request first ("Create a new
-- request" per the brief), generates the reference code with a
-- retry-on-conflict loop (only SQL can see the unique-constraint failure
-- to retry on), and takes the already-hashed token as a parameter -- the
-- raw token is generated in Node (crypto.randomBytes) and never touches
-- this function or the database.
create function create_payment_request(
  p_fee_account_id uuid,
  p_collection_account_id uuid,
  p_amount_paise bigint,
  p_include_upi boolean,
  p_include_bank boolean,
  p_expiry_days integer,
  p_token_hash bytea
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending bigint;
  v_fee_status text;
  v_branch_id uuid;
  v_collection_branch_id uuid;
  v_collection_active boolean;
  v_alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_reference_code text;
  v_attempt integer := 0;
  v_id uuid;
  v_conflicting_constraint text;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can create a payment request';
  end if;

  select fb.pending_paise, fb.status, s.branch_id
    into v_pending, v_fee_status, v_branch_id
  from fee_account_balance fb
  join student s on s.id = fb.student_id
  where fb.fee_account_id = p_fee_account_id;

  if not found then
    raise exception 'fee account % not found', p_fee_account_id;
  end if;
  if v_fee_status = 'discontinued' then
    raise exception 'this fee account is discontinued';
  end if;
  if p_amount_paise <= 0 or p_amount_paise > v_pending then
    raise exception 'invalid amount';
  end if;

  select branch_id, is_active into v_collection_branch_id, v_collection_active
  from collection_account where id = p_collection_account_id;

  if not found or not v_collection_active or v_collection_branch_id is distinct from v_branch_id then
    raise exception 'invalid collection account';
  end if;

  update payment_request
  set status = 'cancelled', closed_reason = 'cancelled', updated_at = now()
  where fee_account_id = p_fee_account_id and status = 'open';

  loop
    v_attempt := v_attempt + 1;
    v_bytes := extensions.gen_random_bytes(5);
    v_reference_code := 'EK-' || (
      select string_agg(substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1), '')
      from generate_series(0, 4) as i
    );
    begin
      insert into payment_request
        (fee_account_id, collection_account_id, reference_code, amount_paise,
         include_upi, include_bank, status, token_hash, expires_at, created_by)
      values
        (p_fee_account_id, p_collection_account_id, v_reference_code, p_amount_paise,
         p_include_upi, p_include_bank, 'open', p_token_hash,
         now() + (p_expiry_days || ' days')::interval, auth.uid())
      returning id into v_id;
      exit;
    exception when unique_violation then
      -- Two distinct unique constraints can fire on this one insert:
      -- reference_code's own (rare, random -- worth retrying with a fresh
      -- code) and payment_request_one_open_per_fee_account's (a second
      -- concurrent create on the same account raced the cancel-then-insert
      -- above -- retrying with a new code would never fix that one, and
      -- silently doing it five times produced a "could not generate a
      -- unique reference code" error that had nothing to do with the real
      -- problem). Only the first is safe to retry.
      get stacked diagnostics v_conflicting_constraint = constraint_name;
      if v_conflicting_constraint <> 'payment_request_reference_code_key' then
        raise;
      end if;
      if v_attempt >= 5 then
        raise exception 'could not generate a unique reference code';
      end if;
    end;
  end loop;

  return jsonb_build_object('id', v_id, 'referenceCode', v_reference_code);
end;
$$;

grant execute on function create_payment_request(
  uuid, uuid, bigint, boolean, boolean, integer, bytea
) to authenticated;

create function cancel_payment_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not auth_is_admin() then
    raise exception 'only an admin can cancel a payment request';
  end if;

  update payment_request
  set status = 'cancelled', closed_reason = 'cancelled', updated_at = now()
  where id = p_id and status = 'open';
end;
$$;

grant execute on function cancel_payment_request(uuid) to authenticated;

-- "Share again" on an already-open request: only the token's hash is ever
-- stored (brief section 3), so there's no way to recover the raw token
-- once the dialog that showed it once is closed. Reopening the dialog on
-- an existing open request can't just redisplay the old link -- this
-- issues a fresh token for the *same* request row (no new reference code,
-- no change to amount/expiry/collection account), and the old token stops
-- working the instant this overwrites its hash.
create function reissue_payment_request_token(p_id uuid, p_token_hash bytea)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not auth_is_admin() then
    raise exception 'only an admin can reissue a payment request token';
  end if;

  update payment_request
  set token_hash = p_token_hash, updated_at = now()
  where id = p_id and status = 'open';

  if not found then
    raise exception 'this request is no longer open';
  end if;
end;
$$;

grant execute on function reissue_payment_request_token(uuid, bytea) to authenticated;
