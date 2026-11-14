-- Deleting a collection account from Settings.
--
-- payment_request.collection_account_id points at the account a request was
-- sent with, and the pay page and the verification queue read the UPI id
-- and bank details from it. So an account that has ever been used can't
-- simply go: its past requests would lose the details they were sent with
-- (and the foreign key refuses it anyway). Such an account is marked deleted
-- instead -- gone from Settings, never offered or accepted for a new request
-- (is_active false, which the request picker and create_payment_request
-- already require), but still there for the requests that used it. An
-- account that was never used is removed outright.
alter table collection_account add column deleted_at timestamptz;

-- Same shape as save_collection_account: admin only, current password
-- re-entered, a row in collection_account_change_log (after = deleted), and
-- the students whose open request was cancelled by it returned so the
-- screen can say who needs a new link.
create function delete_collection_account(
  p_id uuid,
  p_current_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old collection_account%rowtype;
  v_used boolean;
  v_cancelled_ids uuid[];
begin
  if not auth_is_admin() then
    raise exception 'only an admin can manage collection accounts';
  end if;

  if not coalesce(verify_current_password(p_current_password), false) then
    raise exception 'incorrect password';
  end if;

  select * into v_old from collection_account
  where id = p_id and deleted_at is null
  for update;
  if not found then
    raise exception 'collection account % not found', p_id;
  end if;

  insert into collection_account_change_log (collection_account_id, actor, before, after)
  values (
    p_id,
    auth.uid(),
    jsonb_build_object(
      'label', v_old.label,
      'upi_id', v_old.upi_id,
      'payee_name', v_old.payee_name,
      'bank_name', v_old.bank_name,
      'account_holder', v_old.account_holder,
      'account_number', case when v_old.account_number is null then null
        else '••••' || right(v_old.account_number, 4) end,
      'ifsc', v_old.ifsc,
      'is_active', v_old.is_active
    ),
    jsonb_build_object('deleted', true)
  );

  v_used := exists (
    select 1 from payment_request where collection_account_id = p_id
  );

  if v_used then
    -- A parent may still be holding a pay link that shows these details.
    with cancelled as (
      update payment_request
      set status = 'cancelled', closed_reason = 'account_changed', updated_at = now()
      where collection_account_id = p_id and status = 'open'
      returning id
    )
    select array_agg(id) into v_cancelled_ids from cancelled;

    update collection_account set
      deleted_at = now(),
      is_active = false,
      is_default = false,
      updated_by = auth.uid(),
      updated_at = now()
    where id = p_id;
  else
    delete from collection_account where id = p_id;
  end if;

  return jsonb_build_object(
    'id', p_id,
    'removed', not v_used,
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

grant execute on function delete_collection_account(uuid, text) to authenticated;
