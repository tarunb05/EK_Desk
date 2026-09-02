-- Three typed submission tables (typed columns, not jsonb -- same
-- convention every other table in this schema follows), backing the
-- teacher-submits / admin-approves flow: a teacher can propose a new
-- student, an edit to an existing student's details and fee-account terms,
-- or a payment. None of it touches student/fee_account/payment until an
-- admin approves it.

create table student_submission (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branch (id),
  submitted_by uuid not null references profile (id),
  submitted_at timestamptz not null default now(),
  admission_no text not null,
  full_name text not null,
  guardian_name text not null,
  phone text not null,
  class_section text not null,
  notes text,
  academic_year_id uuid not null references academic_year (id),
  service_type text not null check (service_type in ('transport', 'daycare')),
  total_receivable_paise bigint not null check (total_receivable_paise >= 0),
  due_date date not null,
  starts_on date not null,
  ends_on date not null,
  route_name text,
  pickup_point text,
  slot text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profile (id),
  reviewed_at timestamptz,
  review_note text,
  created_student_id uuid references student (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_submission_ends_after_starts check (ends_on >= starts_on),
  -- Mirrors fee_account_service_columns exactly -- a bad submission is
  -- rejected at the database, not only by the Zod schema.
  constraint student_submission_service_columns check (
    (service_type = 'transport' and slot is null)
    or
    (service_type = 'daycare' and route_name is null and pickup_point is null)
  ),
  constraint student_submission_approved_is_complete check (
    status <> 'approved' or (created_student_id is not null and reviewed_by is not null)
  ),
  constraint student_submission_review_matches_status check (
    (status = 'pending') = (reviewed_by is null and reviewed_at is null)
  )
);

-- Two teachers can't queue the same admission number at once.
create unique index student_submission_one_pending_admission
  on student_submission (branch_id, admission_no)
  where status = 'pending';

create index student_submission_status on student_submission (status);

create table student_edit_submission (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student (id),
  fee_account_id uuid not null references fee_account (id),
  branch_id uuid not null references branch (id),
  submitted_by uuid not null references profile (id),
  submitted_at timestamptz not null default now(),
  full_name text not null,
  guardian_name text not null,
  phone text not null,
  class_section text not null,
  notes text,
  total_receivable_paise bigint not null check (total_receivable_paise >= 0),
  due_date date not null,
  starts_on date not null,
  ends_on date not null,
  fee_account_status text not null check (fee_account_status in ('active', 'discontinued')),
  route_name text,
  pickup_point text,
  slot text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profile (id),
  reviewed_at timestamptz,
  review_note text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_edit_submission_ends_after_starts check (ends_on >= starts_on),
  constraint student_edit_submission_review_matches_status check (
    (status = 'pending') = (reviewed_by is null and reviewed_at is null)
  )
  -- No route_name/slot cross-service CHECK here -- a fee_account's
  -- service_type never changes via an edit, so the approval function reads
  -- the real service_type off the existing row and nulls out whichever of
  -- route_name/pickup_point/slot doesn't apply, exactly like updateFeeAccount
  -- does today. Duplicating service_type onto this table just to re-derive
  -- what the referenced row already knows would be redundant state.
);

create index student_edit_submission_status on student_edit_submission (status);

create table payment_submission (
  id uuid primary key default gen_random_uuid(),
  fee_account_id uuid not null references fee_account (id),
  branch_id uuid not null references branch (id),
  submitted_by uuid not null references profile (id),
  submitted_at timestamptz not null default now(),
  amount_paise bigint not null check (amount_paise > 0),
  paid_on date not null,
  method text not null check (method in ('cash', 'upi', 'cheque', 'bank_transfer')),
  reference text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profile (id),
  reviewed_at timestamptz,
  review_note text,
  created_payment_id uuid references payment (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_submission_review_matches_status check (
    (status = 'pending') = (reviewed_by is null and reviewed_at is null)
  )
);

create index payment_submission_status on payment_submission (status);

-- RLS: admin full access on all three, matching every other table's
-- admin policy. Teacher insert is checked against the ACTUAL branch of the
-- referenced student/fee_account (an exists(...) against the real row),
-- never against a client-supplied branch_id column alone -- the column is
-- kept for display convenience on the Approvals page, but trusting it for
-- authorization would let a submitted branch_id lie about which branch the
-- targeted student actually belongs to.

alter table student_submission enable row level security;
alter table student_edit_submission enable row level security;
alter table payment_submission enable row level security;

grant select, insert, update on student_submission to authenticated;
grant select, insert, update on student_edit_submission to authenticated;
grant select, insert, update on payment_submission to authenticated;

create policy "admin full access" on student_submission
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher inserts for own branch" on student_submission
  for insert to authenticated
  with check (
    auth_role() = 'teacher'
    and submitted_by = auth.uid()
    and branch_id = auth_branch_id()
  );

create policy "teacher reads own submissions" on student_submission
  for select to authenticated
  using (auth_role() = 'teacher' and submitted_by = auth.uid());

create policy "admin full access" on student_edit_submission
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher inserts for own branch" on student_edit_submission
  for insert to authenticated
  with check (
    auth_role() = 'teacher'
    and submitted_by = auth.uid()
    and exists (
      select 1 from student s
      where s.id = student_edit_submission.student_id
        and s.branch_id = auth_branch_id()
    )
  );

create policy "teacher reads own submissions" on student_edit_submission
  for select to authenticated
  using (auth_role() = 'teacher' and submitted_by = auth.uid());

create policy "admin full access" on payment_submission
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher inserts for own branch" on payment_submission
  for insert to authenticated
  with check (
    auth_role() = 'teacher'
    and submitted_by = auth.uid()
    and exists (
      select 1 from fee_account fa
      join student s on s.id = fa.student_id
      where fa.id = payment_submission.fee_account_id
        and s.branch_id = auth_branch_id()
    )
  );

create policy "teacher reads own submissions" on payment_submission
  for select to authenticated
  using (auth_role() = 'teacher' and submitted_by = auth.uid());

-- Approval: one security definer function per submission type. Each
-- re-reads the row `for update` (row lock), refuses if it's not `pending`,
-- and only then applies the change -- a concurrent double-approve (two
-- admins, or one admin double-clicking) blocks on the lock and the second
-- caller sees the already-approved row, producing exactly one real record
-- rather than two. Rejection needs no function: the admin's own
-- "admin full access" policy already permits a plain UPDATE.

create function approve_student_submission(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row student_submission%rowtype;
  v_student_id uuid;
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

  insert into student
    (branch_id, admission_no, full_name, guardian_name, phone, class_section, notes)
  values
    (v_row.branch_id, v_row.admission_no, v_row.full_name, v_row.guardian_name,
     v_row.phone, v_row.class_section, v_row.notes)
  returning id into v_student_id;

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

create function approve_student_edit(p_id uuid)
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

create function approve_payment_submission(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row payment_submission%rowtype;
  v_payment_id uuid;
  v_recorded_by text;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can approve a submission';
  end if;

  select * into v_row from payment_submission where id = p_id for update;
  if not found then
    raise exception 'submission % not found', p_id;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'submission % is not pending', p_id;
  end if;

  select full_name into v_recorded_by from profile where id = v_row.submitted_by;

  insert into payment
    (fee_account_id, amount_paise, paid_on, method, reference, note, recorded_by)
  values
    (v_row.fee_account_id, v_row.amount_paise, v_row.paid_on, v_row.method,
     v_row.reference, v_row.note, coalesce(v_recorded_by, 'Teacher'))
  returning id into v_payment_id;

  update payment_submission
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      created_payment_id = v_payment_id,
      updated_at = now()
  where id = p_id;

  return v_payment_id;
end;
$$;

grant execute on function approve_student_submission(uuid) to authenticated;
grant execute on function approve_student_edit(uuid) to authenticated;
grant execute on function approve_payment_submission(uuid) to authenticated;
