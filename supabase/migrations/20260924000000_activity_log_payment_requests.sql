-- Every write to payment_request/payment_claim already goes through a
-- security definer function (create_payment_request, confirm_payment_claim,
-- cancel_payment_request, submit_payment_claim, etc.) -- exactly the
-- "nobody can forget to log it, including a path that never touches Node"
-- reasoning CLAUDE.md rule 12 already states for the other seven tables.
-- Same trigger, extended to two more tables, not a new mechanism.

alter table activity_log drop constraint activity_log_entity_check;
alter table activity_log add constraint activity_log_entity_check
  check (entity in (
    'student', 'fee_account', 'payment', 'expense',
    'expense_category', 'student_submission', 'profile',
    'payment_request', 'payment_claim',
    'system'
  ));

create or replace function log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_actor_label text;
  v_actor_role text;
  v_action text;
  v_entity_id uuid;
  v_entity_label text;
  v_branch_id uuid;
  v_academic_year_id uuid;
  v_summary text;
  v_changed_fields text[];
  v_before_amount bigint;
  v_after_amount bigint;
  v_old_clean jsonb;
  v_new_clean jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is not null then
    select full_name, role into v_actor_label, v_actor_role
    from public.profile where id = v_actor_id;
  end if;
  if v_actor_label is null then
    v_actor_label := 'System';
  end if;

  v_action := case TG_OP
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
  end;

  if TG_OP = 'UPDATE' then
    v_old_clean := to_jsonb(old) - 'updated_at' - 'updated_by';
    v_new_clean := to_jsonb(new) - 'updated_at' - 'updated_by';
    if v_old_clean = v_new_clean then
      return null;
    end if;
    select array_agg(n.key) into v_changed_fields
    from jsonb_each(v_new_clean) as n(key, value)
    where v_new_clean -> n.key is distinct from v_old_clean -> n.key;
  end if;

  v_entity_id := case TG_OP when 'DELETE' then old.id else new.id end;

  if TG_TABLE_NAME = 'student' then
    v_entity_label := case TG_OP when 'DELETE' then old.full_name else new.full_name end;
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_summary := case v_action
      when 'create' then 'Added student ' || v_entity_label
      when 'update' then 'Updated student ' || v_entity_label
      when 'delete' then 'Deleted student ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'fee_account' then
    select s.full_name, s.branch_id into v_entity_label, v_branch_id
    from public.student s
    where s.id = case TG_OP when 'DELETE' then old.student_id else new.student_id end;
    v_entity_label := coalesce(v_entity_label, 'a student no longer on record');
    v_academic_year_id := case TG_OP when 'DELETE' then old.academic_year_id else new.academic_year_id end;
    v_before_amount := case when TG_OP = 'INSERT' then null else old.total_receivable_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.total_receivable_paise end;
    v_summary := case v_action
      when 'create' then 'Added ' || new.service_type || ' fee account for ' || v_entity_label
      when 'update' then 'Updated ' || new.service_type || ' fee account for ' || v_entity_label
      when 'delete' then 'Removed ' || old.service_type || ' fee account for ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'payment' then
    select s.full_name, s.branch_id, fa.academic_year_id
      into v_entity_label, v_branch_id, v_academic_year_id
    from public.fee_account fa
    join public.student s on s.id = fa.student_id
    where fa.id = case TG_OP when 'DELETE' then old.fee_account_id else new.fee_account_id end;
    v_entity_label := coalesce(v_entity_label, 'a student no longer on record');
    v_before_amount := case when TG_OP = 'INSERT' then null else old.amount_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.amount_paise end;
    v_summary := case
      when v_action = 'create' then 'Recorded a payment for ' || v_entity_label
      when v_action = 'update' then 'Voided a payment for ' || v_entity_label
        || coalesce(' — ' || new.void_reason, '')
      when v_action = 'delete' then 'Removed a payment for ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'expense' then
    select c.name into v_entity_label
    from public.expense_category c
    where c.id = case TG_OP when 'DELETE' then old.category_id else new.category_id end;
    v_entity_label := coalesce(v_entity_label, 'an unknown category');
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_academic_year_id := case TG_OP when 'DELETE' then old.academic_year_id else new.academic_year_id end;
    v_before_amount := case when TG_OP = 'INSERT' then null else old.amount_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.amount_paise end;
    v_summary := case v_action
      when 'create' then 'Recorded an expense in ' || v_entity_label
      when 'update' then 'Updated an expense in ' || v_entity_label
      when 'delete' then 'Deleted an expense in ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'expense_category' then
    v_entity_label := case TG_OP when 'DELETE' then old.name else new.name end;
    v_summary := case v_action
      when 'create' then 'Added category ' || v_entity_label
      when 'update' then 'Updated category ' || v_entity_label
      when 'delete' then 'Deleted category ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'student_submission' then
    v_entity_label := case TG_OP when 'DELETE' then old.full_name else new.full_name end;
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_academic_year_id := case TG_OP when 'DELETE' then old.academic_year_id else new.academic_year_id end;
    v_before_amount := case when TG_OP = 'INSERT' then null else old.total_receivable_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.total_receivable_paise end;
    v_summary := case
      when v_action = 'create' then 'Submitted a ' || new.service_type || ' request for ' || v_entity_label
      when v_action = 'update' and new.status = 'approved' and old.status = 'pending'
        then 'Approved the ' || new.service_type || ' request for ' || v_entity_label
      when v_action = 'update' and new.status = 'rejected' and old.status = 'pending'
        then 'Rejected the ' || new.service_type || ' request for ' || v_entity_label
          || coalesce(' — ' || new.review_note, '')
      when v_action = 'update' then 'Updated the request for ' || v_entity_label
      when v_action = 'delete' then 'Removed the request for ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'profile' then
    v_entity_label := case TG_OP when 'DELETE' then old.full_name else new.full_name end;
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_summary := case
      when v_action = 'create' then 'Added user ' || v_entity_label
      when v_action = 'update' and new.role is distinct from old.role
        then 'Changed ' || v_entity_label || '''s role to ' || new.role
      when v_action = 'update' and new.is_active = false and old.is_active = true
        then 'Deactivated user ' || v_entity_label
      when v_action = 'update' and new.is_active = true and old.is_active = false
        then 'Reactivated user ' || v_entity_label
      when v_action = 'update' then 'Updated user ' || v_entity_label
      when v_action = 'delete' then 'Removed user ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'payment_request' then
    select s.full_name, s.branch_id, fa.academic_year_id
      into v_entity_label, v_branch_id, v_academic_year_id
    from public.fee_account fa
    join public.student s on s.id = fa.student_id
    where fa.id = case TG_OP when 'DELETE' then old.fee_account_id else new.fee_account_id end;
    -- Only ever cascade-deleted (a hard-deleted student, same as
    -- fee_account/payment above) -- by the time that cascade reaches this
    -- row, the join back to fee_account/student may already be gone.
    v_entity_label := coalesce(v_entity_label, 'a student no longer on record');
    v_after_amount := case when TG_OP = 'INSERT' then new.amount_paise else null end;
    v_summary := case
      when v_action = 'create' then 'Requested a payment for ' || v_entity_label
      when v_action = 'update' and new.status = 'closed' and old.status = 'open'
        then 'Closed the payment request for ' || v_entity_label
          || coalesce(' (' || new.closed_reason || ')', '')
      when v_action = 'update' and new.status = 'cancelled' and old.status = 'open'
        then 'Cancelled the payment request for ' || v_entity_label
          || coalesce(' (' || new.closed_reason || ')', '')
      when v_action = 'update' then 'Updated the payment request for ' || v_entity_label
      when v_action = 'delete' then 'Removed the payment request for ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'payment_claim' then
    select s.full_name, s.branch_id, fa.academic_year_id
      into v_entity_label, v_branch_id, v_academic_year_id
    from public.payment_request pr
    join public.fee_account fa on fa.id = pr.fee_account_id
    join public.student s on s.id = fa.student_id
    where pr.id = case TG_OP when 'DELETE' then old.payment_request_id else new.payment_request_id end;
    v_entity_label := coalesce(v_entity_label, 'a student no longer on record');
    v_after_amount := case when TG_OP = 'INSERT' then new.claimed_amount_paise else null end;
    v_summary := case
      when v_action = 'create' then 'Reported a payment claim for ' || v_entity_label
        || case when new.source = 'admin_entered' then ' (entered by admin)' else '' end
      when v_action = 'update' and new.status = 'confirmed' and old.status = 'pending'
        then 'Confirmed a payment claim for ' || v_entity_label
      when v_action = 'update' and new.status = 'rejected' and old.status = 'pending'
        then 'Rejected a payment claim for ' || v_entity_label
          || coalesce(' — ' || new.reject_reason, '')
      when v_action = 'update' then 'Updated a payment claim for ' || v_entity_label
      when v_action = 'delete' then 'Removed a payment claim for ' || v_entity_label
    end;
  end if;

  if v_entity_label is null then
    v_entity_label := 'Unknown';
  end if;

  insert into public.activity_log (
    actor_id, actor_label, actor_role, action, entity, entity_id, entity_label,
    branch_id, academic_year_id, summary, changed_fields,
    before_amount_paise, after_amount_paise
  ) values (
    v_actor_id, v_actor_label, v_actor_role, v_action, TG_TABLE_NAME, v_entity_id, v_entity_label,
    v_branch_id, v_academic_year_id, v_summary, v_changed_fields,
    v_before_amount, v_after_amount
  );

  return null;
exception
  when others then
    raise warning 'activity_log: logging failed for % on % (%): %',
      TG_OP, TG_TABLE_NAME, coalesce(v_entity_id::text, 'unknown'), sqlerrm;
    return null;
end;
$$;

create trigger activity_log_payment_request
  after insert or update or delete on payment_request
  for each row execute function log_activity();

create trigger activity_log_payment_claim
  after insert or update or delete on payment_claim
  for each row execute function log_activity();
