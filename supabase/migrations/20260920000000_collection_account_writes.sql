-- Phase 15.2: collection accounts, the highest-risk screen in the app --
-- writes are gated by re-authentication, produce a masked audit row, and
-- cancel every open payment_request against an account whose UPI/bank
-- details actually changed.

-- Re-authentication without touching the caller's own session.
-- supabase.auth.signInWithPassword() would be the documented way to check
-- a password server-side, but it always creates a brand-new session for
-- that user -- this project's own playwright.config.ts already documents,
-- from something hit empirically, that Supabase's refresh-token rotation
-- invalidates a session when another sign-in rotates the same account's
-- token concurrently. Calling that for an admin who is already signed in
-- and about to save this very form risks logging them out of their own
-- session. GoTrue stores passwords as bcrypt hashes in
-- auth.users.encrypted_password; pgcrypto's crypt() (already installed --
-- see the initial schema migration, used today for gen_random_uuid())
-- verifies a bcrypt hash directly, the same primitive GoTrue itself uses,
-- with zero session creation.
create function verify_current_password(p_password text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  -- Supabase's own Postgres image installs pgcrypto into the `extensions`
  -- schema regardless of the plain `create extension if not exists
  -- pgcrypto` in the initial migration (which only ensures it exists
  -- somewhere, not where) -- schema-qualified rather than relying on
  -- search_path order, so this doesn't silently break if that ever shifts.
  select encrypted_password = extensions.crypt(p_password, encrypted_password::text)
  from auth.users where id = auth.uid()
$$;

grant execute on function verify_current_password(text) to authenticated;

-- One function, one transaction (same shape as approve_payment_submission):
-- verify password, snapshot the before-state, write, log (account number
-- masked to its last 4 digits before either jsonb object is built -- the
-- full number is never at rest in collection_account_change_log), then
-- cancel any open request against this account if what a parent would
-- actually pay into changed. p_id null means create.
-- Returns jsonb rather than plain uuid: the caller (the Server Action)
-- needs both the id and the list of requests this call just cancelled, so
-- the UI can show "these students' pay links no longer work -- re-send"
-- (brief section 2) right after the save that triggered it.
-- The optional fields' `default null` isn't about the SQL call convention
-- (Server Actions always call this by name, via supabase-js's rpc(),
-- passing all ten explicitly regardless of position) -- Supabase's type
-- generator reads a parameter with no default as required/non-null on the
-- TS side, and these five are genuinely nullable columns. Postgres itself
-- requires defaulted parameters to trail non-defaulted ones in a function
-- signature, hence the reordering from the columns' own table order.
create function save_collection_account(
  p_id uuid,
  p_branch_id uuid,
  p_label text,
  p_payee_name text,
  p_is_active boolean,
  p_current_password text,
  p_upi_id text default null,
  p_bank_name text default null,
  p_account_holder text default null,
  p_account_number text default null,
  p_ifsc text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old collection_account%rowtype;
  v_id uuid;
  v_sensitive_changed boolean := false;
  v_before jsonb;
  v_after jsonb;
  v_cancelled_ids uuid[];
begin
  if not auth_is_admin() then
    raise exception 'only an admin can manage collection accounts';
  end if;

  if not coalesce(verify_current_password(p_current_password), false) then
    raise exception 'incorrect password';
  end if;

  if p_id is not null then
    select * into v_old from collection_account where id = p_id for update;
    if not found then
      raise exception 'collection account % not found', p_id;
    end if;

    v_sensitive_changed :=
      v_old.upi_id is distinct from p_upi_id
      or v_old.account_number is distinct from p_account_number
      or v_old.ifsc is distinct from p_ifsc
      or v_old.bank_name is distinct from p_bank_name
      or v_old.account_holder is distinct from p_account_holder;

    v_before := jsonb_build_object(
      'label', v_old.label,
      'upi_id', v_old.upi_id,
      'payee_name', v_old.payee_name,
      'bank_name', v_old.bank_name,
      'account_holder', v_old.account_holder,
      'account_number', case when v_old.account_number is null then null
        else '••••' || right(v_old.account_number, 4) end,
      'ifsc', v_old.ifsc,
      'is_active', v_old.is_active
    );

    update collection_account set
      label = p_label,
      upi_id = p_upi_id,
      payee_name = p_payee_name,
      bank_name = p_bank_name,
      account_holder = p_account_holder,
      account_number = p_account_number,
      ifsc = p_ifsc,
      is_active = p_is_active,
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_id;

    v_id := p_id;
  else
    insert into collection_account
      (branch_id, label, upi_id, payee_name, bank_name, account_holder, account_number, ifsc, is_active, updated_by)
    values
      (p_branch_id, p_label, p_upi_id, p_payee_name, p_bank_name, p_account_holder, p_account_number, p_ifsc, p_is_active, auth.uid())
    returning id into v_id;

    v_before := null;
  end if;

  v_after := jsonb_build_object(
    'label', p_label,
    'upi_id', p_upi_id,
    'payee_name', p_payee_name,
    'bank_name', p_bank_name,
    'account_holder', p_account_holder,
    'account_number', case when p_account_number is null then null
      else '••••' || right(p_account_number, 4) end,
    'ifsc', p_ifsc,
    'is_active', p_is_active
  );

  insert into collection_account_change_log (collection_account_id, actor, before, after)
  values (v_id, auth.uid(), v_before, v_after);

  -- A brand-new account has no existing requests to cancel --
  -- v_sensitive_changed stays false on the insert path above.
  if v_sensitive_changed then
    with cancelled as (
      update payment_request
      set status = 'cancelled', closed_reason = 'account_changed', updated_at = now()
      where collection_account_id = v_id and status = 'open'
      returning id
    )
    select array_agg(id) into v_cancelled_ids from cancelled;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'affected', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'studentName', s.full_name,
          'admissionNo', s.admission_no,
          'serviceType', fa.service_type
        ))
        from payment_request pr
        join fee_account fa on fa.id = pr.fee_account_id
        join student s on s.id = fa.student_id
        where pr.id = any(v_cancelled_ids)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function save_collection_account(
  uuid, uuid, text, text, boolean, text, text, text, text, text, text
) to authenticated;

-- The partial unique index on (branch_id) where is_default is what
-- actually guarantees "one default per branch" under a race (a concurrent
-- second call fails outright, per the brief's own answer for this kind of
-- conflict elsewhere) -- this just makes the single-admin-acting case do
-- the obvious thing in one call instead of two.
create function set_default_collection_account(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can manage collection accounts';
  end if;

  select branch_id into v_branch_id from collection_account where id = p_id for update;
  if not found then
    raise exception 'collection account % not found', p_id;
  end if;

  update collection_account set is_default = false, updated_at = now()
  where branch_id = v_branch_id and is_default and id <> p_id;

  update collection_account set is_default = true, updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function set_default_collection_account(uuid) to authenticated;
