-- Lets a teacher create, share, and cancel a payment request for a student
-- in their own branch -- the same three actions an admin has, minus
-- confirming/rejecting a claim (still admin-only: that's the step that
-- actually records money received, closer to recordPayment, which already
-- requires teacher submission + admin approval). A payment request itself
-- creates no receivable and settles no account -- it only generates a
-- WhatsApp/SMS link showing a UPI id and bank details already on file --
-- so this follows the same reasoning CLAUDE.md rule 10 gives for letting a
-- teacher record an expense directly: gating it behind approval would be
-- ceremony, not safety.
--
-- collection_account/payment_request/payment_claim were deliberately
-- admin-only when 15.1 built them ("fraud-adjacent, not a students-list
-- figure"). Read access is widened here to a teacher's own branch (needed
-- for the request dialog itself, and for the Students-list "Request open"/
-- "Payment reported" markers, which already render for every role but have
-- had nothing to read from since payment_request has never had a teacher
-- policy -- so those markers have silently never shown for a teacher).
-- Writes stay funneled through security-definer functions only, exactly
-- the existing pattern: no teacher INSERT/UPDATE policy is added on any of
-- the three tables.

create policy "teacher reads own branch" on collection_account
  for select to authenticated
  using (auth_role() = 'teacher' and branch_id = auth_branch_id());

create policy "teacher reads own branch" on payment_request
  for select to authenticated
  using (
    auth_role() = 'teacher'
    and exists (
      select 1 from fee_account fa
      join student s on s.id = fa.student_id
      where fa.id = payment_request.fee_account_id
        and s.branch_id = auth_branch_id()
    )
  );

create policy "teacher reads own branch" on payment_claim
  for select to authenticated
  using (
    auth_role() = 'teacher'
    and exists (
      select 1 from payment_request pr
      join fee_account fa on fa.id = pr.fee_account_id
      join student s on s.id = fa.student_id
      where pr.id = payment_claim.payment_request_id
        and s.branch_id = auth_branch_id()
    )
  );

-- create_payment_request: the admin-only guard moves after the branch
-- lookup it already does (v_branch_id was computed either way), and now
-- also passes a teacher whose own branch matches the fee account's.
create or replace function create_payment_request(
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
  select fb.pending_paise, fb.status, s.branch_id
    into v_pending, v_fee_status, v_branch_id
  from fee_account_balance fb
  join student s on s.id = fb.student_id
  where fb.fee_account_id = p_fee_account_id;

  if not found then
    raise exception 'fee account % not found', p_fee_account_id;
  end if;

  if not (auth_is_admin() or (auth_role() = 'teacher' and v_branch_id = auth_branch_id())) then
    raise exception 'not allowed to create a payment request for this fee account';
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

-- cancel_payment_request / reissue_payment_request_token: same admin-or-
-- own-branch-teacher check, looked up via the request's own fee account
-- since (unlike create) neither of these already reads it. Looking the
-- request up before the role check (rather than after, as the originals
-- did) means an unknown id still raises the exact same message as before --
-- the update these run afterwards already matched zero rows and raised
-- identically for that case, so this changes nothing about what a caller
-- sees, only where in the function the branch is known.
create or replace function cancel_payment_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  select s.branch_id into v_branch_id
  from payment_request pr
  join fee_account fa on fa.id = pr.fee_account_id
  join student s on s.id = fa.student_id
  where pr.id = p_id;

  if not found then
    raise exception 'payment request % not found', p_id;
  end if;

  if not (auth_is_admin() or (auth_role() = 'teacher' and v_branch_id = auth_branch_id())) then
    raise exception 'not allowed to cancel this payment request';
  end if;

  update payment_request
  set status = 'cancelled', closed_reason = 'cancelled', updated_at = now()
  where id = p_id and status = 'open';
end;
$$;

create or replace function reissue_payment_request_token(p_id uuid, p_token_hash bytea)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  select s.branch_id into v_branch_id
  from payment_request pr
  join fee_account fa on fa.id = pr.fee_account_id
  join student s on s.id = fa.student_id
  where pr.id = p_id;

  if not found then
    raise exception 'this request is no longer open';
  end if;

  if not (auth_is_admin() or (auth_role() = 'teacher' and v_branch_id = auth_branch_id())) then
    raise exception 'not allowed to reissue this payment request';
  end if;

  update payment_request
  set token_hash = p_token_hash, updated_at = now()
  where id = p_id and status = 'open';

  if not found then
    raise exception 'this request is no longer open';
  end if;
end;
$$;

-- Two more small security-definer functions, same shape, for the two raw
-- table UPDATEs the Node side used to run directly (recordShareChannel
-- against payment_request, markNumberUnreachable against student). Both
-- previously worked only because the admin-only RLS policy allowed them --
-- extending that policy to a raw teacher UPDATE grant on `student` would
-- contradict CLAUDE.md rule 6 ("a teacher writes nothing directly to
-- student/fee_account/payment"), so these wrap the one field each of those
-- actions touches instead, the same controlled-exception pattern this
-- schema already uses everywhere else (hard_delete_student,
-- confirm_payment_claim, and now create/cancel/reissue above).
create function record_payment_request_share(
  p_id uuid,
  p_shared_via text,
  p_shared_to_last4 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  select s.branch_id into v_branch_id
  from payment_request pr
  join fee_account fa on fa.id = pr.fee_account_id
  join student s on s.id = fa.student_id
  where pr.id = p_id;

  if not found then
    raise exception 'payment request % not found', p_id;
  end if;

  if not (auth_is_admin() or (auth_role() = 'teacher' and v_branch_id = auth_branch_id())) then
    raise exception 'not allowed to update this payment request';
  end if;

  update payment_request
  set shared_at = now(), shared_via = p_shared_via, shared_to_last4 = p_shared_to_last4
  where id = p_id;
end;
$$;

grant execute on function record_payment_request_share(uuid, text, text) to authenticated;

create function mark_student_phone_unreachable(p_student_id uuid, p_field text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  if p_field not in ('phone', 'whatsappPhone') then
    raise exception 'invalid field %', p_field;
  end if;

  select branch_id into v_branch_id from student where id = p_student_id;
  if not found then
    raise exception 'student % not found', p_student_id;
  end if;

  if not (auth_is_admin() or (auth_role() = 'teacher' and v_branch_id = auth_branch_id())) then
    raise exception 'not allowed to update this student';
  end if;

  update student
  set phone_not_on_whatsapp_at =
        case when p_field = 'phone' then now() else phone_not_on_whatsapp_at end,
      whatsapp_phone_not_on_whatsapp_at =
        case when p_field = 'whatsappPhone' then now() else whatsapp_phone_not_on_whatsapp_at end
  where id = p_student_id;
end;
$$;

grant execute on function mark_student_phone_unreachable(uuid, text) to authenticated;
