-- An optional second contact number, distinct from the primary phone, that
-- can be added when a student is created or edited -- the same
-- student.whatsapp_phone column Phase 15.1 added for the request dialog's
-- phone picker, but until now nothing ever wrote to it: neither
-- createStudentWithFeeAccount nor updateFeeAccount exposed a field for it,
-- so it sat permanently null for every student added since. This carries it
-- through the two submission tables so a teacher's add/edit path can set it
-- too, same as every other student field on those tables.

alter table student_submission add column whatsapp_phone text;
alter table student_edit_submission add column whatsapp_phone text;

-- Based on the reuse_student_across_services version of this function, not
-- the original in 20260824000000 -- that later migration taught this
-- function to reuse an existing student row for a second service instead
-- of always inserting a new one; replacing straight from the original would
-- have silently reverted that fix the moment this migration ran.
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
    select count(*) into v_existing_active_count
    from fee_account
    where student_id = v_student_id
      and service_type = v_row.service_type
      and status = 'active';

    if v_existing_active_count > 0 then
      raise exception 'admission number % already has an active % student',
        v_row.admission_no, v_row.service_type;
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

create or replace function approve_student_edit(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row student_edit_submission%rowtype;
  v_service_type text;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can approve a submission';
  end if;

  select * into v_row from student_edit_submission where id = p_id for update;
  if not found then
    raise exception 'submission % not found', p_id;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'submission % is not pending', p_id;
  end if;

  select service_type into v_service_type from fee_account where id = v_row.fee_account_id;

  update student
  set full_name = v_row.full_name,
      guardian_name = v_row.guardian_name,
      phone = v_row.phone,
      whatsapp_phone = v_row.whatsapp_phone,
      class_section = v_row.class_section,
      notes = v_row.notes,
      updated_at = now()
  where id = v_row.student_id;

  update fee_account
  set total_receivable_paise = v_row.total_receivable_paise,
      due_date = v_row.due_date,
      starts_on = v_row.starts_on,
      ends_on = v_row.ends_on,
      status = v_row.fee_account_status,
      route_name = case when v_service_type = 'transport' then v_row.route_name else null end,
      pickup_point = case when v_service_type = 'transport' then v_row.pickup_point else null end,
      slot = case when v_service_type = 'daycare' then v_row.slot else null end,
      updated_at = now()
  where id = v_row.fee_account_id;

  update student_edit_submission
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      applied_at = now(),
      updated_at = now()
  where id = p_id;
end;
$$;

-- Appended at the very end, same convention as every prior addition to this
-- view (student_status, student_notes) -- CREATE OR REPLACE VIEW can only
-- add columns after the existing ones. Needed so the edit form can default
-- its new WhatsApp field to whatever's already on record.
create or replace view fee_account_record
with (security_invoker = true) as
select
  fab.*,
  s.full_name as student_full_name,
  s.admission_no as student_admission_no,
  s.class_section,
  s.guardian_name as student_guardian_name,
  s.phone as student_phone,
  b.id as branch_id,
  b.code as branch_code,
  b.name as branch_name,
  s.status as student_status,
  s.notes as student_notes,
  s.whatsapp_phone as student_whatsapp_phone
from fee_account_balance fab
join student s on s.id = fab.student_id
join branch b on b.id = s.branch_id;

grant select on fee_account_record to authenticated;
