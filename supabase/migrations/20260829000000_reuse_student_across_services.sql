-- A student is one `student` row that can carry both a transport AND a
-- daycare fee_account (CLAUDE.md rule 5) -- the same admission number
-- should be usable for both services, just never twice in the same one.
-- approve_student_submission always inserted a brand-new `student` row,
-- which trips student_admission_no_unique_per_branch the moment the same
-- admission number is approved for a second service. This mirrors the fix
-- already applied on the app side (createStudentWithFeeAccount in
-- src/lib/records/actions.ts): reuse the existing student row for this
-- branch+admission number when one exists, and reject the approval outright
-- if that student already has an active fee_account in the submission's own
-- service_type (the admin sees this as the same generic "could not approve"
-- sentence approveSubmission already shows for any RPC error, never a raw
-- Postgres message).
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
      (branch_id, admission_no, full_name, guardian_name, phone, class_section, notes)
    values
      (v_row.branch_id, v_row.admission_no, v_row.full_name, v_row.guardian_name,
       v_row.phone, v_row.class_section, v_row.notes)
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
