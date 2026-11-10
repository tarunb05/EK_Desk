-- Daycare parents enroll for a week, a month or the year, and come back
-- more than once a year -- so a student may now carry several daycare
-- fee_accounts, as long as no two active ones cover the same day. Transport
-- keeps its one-active-account rule unchanged.
--
-- Enforced here rather than only in the app so every write path is covered
-- by the same rule: the admin's direct insert, an admin edit of the dates,
-- reactivating a discontinued account, and both approve_* functions.
-- Discontinued rows are excluded, so a cancelled stint never blocks its
-- replacement. '[]' makes both ends inclusive: 1-30 Nov and 30 Nov-6 Dec
-- overlap, 1-30 Nov and 1-31 Dec don't.

-- btree_gist lets the gist index behind the constraint compare uuids with =.
-- Supabase installs extensions into the `extensions` schema; the default
-- operator class for uuid is found regardless of schema.
create extension if not exists btree_gist with schema extensions;

-- No existing data can violate this: until now a student could only ever
-- have one active daycare account.
alter table fee_account
  add constraint fee_account_daycare_no_overlap
  exclude using gist (
    student_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
  where (service_type = 'daycare' and status = 'active');

-- Same function as 20260925000000_student_whatsapp_contact.sql, except the
-- one-active-account check now only applies to transport; a daycare
-- overlap is rejected by the constraint above when the fee_account insert
-- runs, rolling back the whole approval.
create or replace function approve_student_submission(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row student_submission%rowtype;
  v_student_id uuid;
  v_existing_active_count int;
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
     v_row.due_date, v_row.starts_on, v_row.ends_on, v_row.route_name, v_row.pickup_point, v_row.slot);

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
