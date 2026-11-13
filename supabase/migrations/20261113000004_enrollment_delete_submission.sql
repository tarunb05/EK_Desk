-- A teacher can ask for ONE enrollment (a fee_account) of a student in their
-- branch to be deleted; an admin approves or rejects it. Same
-- teacher-asks/admin-approves shape as student_delete_submission
-- (20260825000003), for the same reason: a teacher never gets a direct
-- delete, because it takes the enrollment's payments with it.
--
-- fee_account_id is `on delete set null`, not cascade, with the names and
-- the enrollment's label copied in at submission time: approving removes the
-- fee_account, and the record of who asked and who approved must survive
-- that.
create table enrollment_delete_submission (
  id uuid primary key default gen_random_uuid(),
  fee_account_id uuid references fee_account (id) on delete set null,
  branch_id uuid not null references branch (id),
  submitted_by uuid not null references profile (id),
  submitted_at timestamptz not null default now(),
  student_full_name text not null,
  student_admission_no text not null,
  enrollment_label text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profile (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollment_delete_submission_review_matches_status check (
    (status = 'pending') = (reviewed_by is null and reviewed_at is null)
  )
);

-- One pending request per enrollment at a time.
create unique index enrollment_delete_submission_one_pending
  on enrollment_delete_submission (fee_account_id)
  where status = 'pending';

create index enrollment_delete_submission_status
  on enrollment_delete_submission (status);

alter table enrollment_delete_submission enable row level security;

grant select, insert, update on enrollment_delete_submission to authenticated;

create policy "admin full access" on enrollment_delete_submission
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher inserts for own branch" on enrollment_delete_submission
  for insert to authenticated
  with check (
    auth_role() = 'teacher'
    and submitted_by = auth.uid()
    and branch_id = auth_branch_id()
    and exists (
      select 1
      from fee_account fa
      join student s on s.id = fa.student_id
      where fa.id = enrollment_delete_submission.fee_account_id
        and s.branch_id = auth_branch_id()
    )
  );

create policy "teacher reads own submissions" on enrollment_delete_submission
  for select to authenticated
  using (auth_role() = 'teacher' and submitted_by = auth.uid());

-- Same shape as the other approve_* functions: security definer with the
-- admin check inside the body, row locked so a double-approve can't run the
-- delete twice, refuses anything not pending. The confirmed-payment guard is
-- checked BEFORE the status flips, so a refused approval leaves the request
-- pending for the admin to reject rather than half-done.
create function approve_enrollment_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row enrollment_delete_submission%rowtype;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can approve a submission';
  end if;

  select * into v_row from enrollment_delete_submission where id = p_id for update;
  if not found then
    raise exception 'submission % not found', p_id;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'submission % is not pending', p_id;
  end if;

  if v_row.fee_account_id is not null and exists (
    select 1
    from payment_claim pc
    join payment_request pr on pr.id = pc.payment_request_id
    where pr.fee_account_id = v_row.fee_account_id and pc.status = 'confirmed'
  ) then
    raise exception 'this enrollment has a confirmed payment on record and can''t be deleted';
  end if;

  update enrollment_delete_submission
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_id;

  -- If the enrollment was already removed some other way, there is nothing
  -- left to do: the request is still legitimately approved.
  if v_row.fee_account_id is not null then
    delete from fee_account where id = v_row.fee_account_id;
  end if;
end;
$$;

grant execute on function approve_enrollment_delete(uuid) to authenticated;
