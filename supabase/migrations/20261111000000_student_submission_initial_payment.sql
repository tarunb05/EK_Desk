-- Staff can mark a student as paid (in full or in part) while adding them,
-- instead of recording the payment as a second step. An admin's add writes
-- the payment directly; a teacher's add carries the payment on the
-- student_submission and approve_student_submission records it in the same
-- transaction that creates the fee_account -- there's no fee_account for a
-- payment_submission to point at until then.

alter table student_submission
  add column paid_amount_paise bigint,
  add column paid_on date,
  add column paid_method text,
  add column paid_reference text,
  -- Amount, date and method come together or not at all; a reference only
  -- makes sense alongside them.
  add constraint student_submission_paid_fields_together check (
    (paid_amount_paise is null) = (paid_on is null)
    and (paid_on is null) = (paid_method is null)
    and (paid_amount_paise is not null or paid_reference is null)
  ),
  add constraint student_submission_paid_amount_in_range check (
    paid_amount_paise is null
    or (paid_amount_paise > 0 and paid_amount_paise <= total_receivable_paise)
  ),
  -- Same list as payment.method (20260919000000_whatsapp_payment_requests).
  add constraint student_submission_paid_method check (
    paid_method is null
    or paid_method in ('cash', 'upi', 'cheque', 'bank_transfer', 'card')
  );

-- Same function as 20261110000000_daycare_non_overlapping_enrollments.sql,
-- plus the payment insert at the end. recorded_by is the submitting
-- teacher's name, the same way approve_payment_submission sets it.
create or replace function approve_student_submission(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row student_submission%rowtype;
  v_student_id uuid;
  v_fee_account_id uuid;
  v_existing_active_count int;
  v_recorded_by text;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can approve a submission';
  end if;

  select * into v_row from student_submission where id = p_id for update;
  if not found then
    raise exception 'submission % not found', p_id;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'submission % is not pending', p_id;
  end if;

  select id into v_student_id
  from student
  where branch_id = v_row.branch_id and admission_no = v_row.admission_no;

  if v_student_id is not null then
    if v_row.service_type = 'transport' then
      select count(*) into v_existing_active_count
      from fee_account
      where student_id = v_student_id
        and service_type = 'transport'
        and status = 'active';

      if v_existing_active_count > 0 then
        raise exception 'admission number % already has an active transport student',
          v_row.admission_no;
      end if;
    end if;
  else
    insert into student
      (branch_id, admission_no, full_name, guardian_name, phone, whatsapp_phone, class_section, notes)
    values
      (v_row.branch_id, v_row.admission_no, v_row.full_name, v_row.guardian_name,
       v_row.phone, v_row.whatsapp_phone, v_row.class_section, v_row.notes)
    returning id into v_student_id;
  end if;

  insert into fee_account
    (student_id, academic_year_id, service_type, total_receivable_paise,
     due_date, starts_on, ends_on, route_name, pickup_point, slot)
  values
    (v_student_id, v_row.academic_year_id, v_row.service_type, v_row.total_receivable_paise,
     v_row.due_date, v_row.starts_on, v_row.ends_on, v_row.route_name, v_row.pickup_point, v_row.slot)
  returning id into v_fee_account_id;

  if v_row.paid_amount_paise is not null then
    select full_name into v_recorded_by from profile where id = v_row.submitted_by;
    insert into payment
      (fee_account_id, amount_paise, paid_on, method, reference, recorded_by)
    values
      (v_fee_account_id, v_row.paid_amount_paise, v_row.paid_on, v_row.paid_method,
       nullif(v_row.paid_reference, ''), coalesce(v_recorded_by, 'Teacher'));
  end if;

  update student_submission
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      created_student_id = v_student_id,
      updated_at = now()
  where id = p_id;

  return v_student_id;
end;
$$;
