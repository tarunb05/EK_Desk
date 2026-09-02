-- A teacher can now request a student's hard delete too -- same
-- teacher-submits/admin-approves shape as the other three submission
-- tables, so admin and teacher stay "exactly the same" on what they can
-- ask for, with approval as the only gate. Unlike the others, approving
-- this one makes the referenced student (and its own submission history
-- rows) disappear -- so student_id can't cascade-delete this row along
-- with it, or the audit trail of "who asked to delete whom, and who
-- approved it" would vanish exactly when it matters most. `on delete set
-- null` plus denormalized student_full_name/student_admission_no (read
-- from the real row server-side at submission time, not trusted from the
-- client) keeps this row meaningful after the student is gone.
create table student_delete_submission (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references student (id) on delete set null,
  branch_id uuid not null references branch (id),
  submitted_by uuid not null references profile (id),
  submitted_at timestamptz not null default now(),
  student_full_name text not null,
  student_admission_no text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profile (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_delete_submission_review_matches_status check (
    (status = 'pending') = (reviewed_by is null and reviewed_at is null)
  )
);

-- One pending delete request per student at a time -- student_id is only
-- ever null once status has already moved off 'pending' (the approval
-- function nulls the FK's target after it, never while pending), so this
-- stays a real constraint for the whole time it matters.
create unique index student_delete_submission_one_pending
  on student_delete_submission (student_id)
  where status = 'pending';

create index student_delete_submission_status
  on student_delete_submission (status);

alter table student_delete_submission enable row level security;

grant select, insert, update on student_delete_submission to authenticated;

create policy "admin full access" on student_delete_submission
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "teacher inserts for own branch" on student_delete_submission
  for insert to authenticated
  with check (
    auth_role() = 'teacher'
    and submitted_by = auth.uid()
    and exists (
      select 1 from student s
      where s.id = student_delete_submission.student_id
        and s.branch_id = auth_branch_id()
    )
  );

create policy "teacher reads own submissions" on student_delete_submission
  for select to authenticated
  using (auth_role() = 'teacher' and submitted_by = auth.uid());

-- Same shape as the other three approve_* functions: security definer,
-- explicit admin check inside the body (bypassing RLS is exactly why that
-- check can't be optional), row locked `for update` so a concurrent
-- double-approve can't run the delete twice, refuses anything not pending.
create function approve_student_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row student_delete_submission%rowtype;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can approve a submission';
  end if;

  select * into v_row from student_delete_submission where id = p_id for update;
  if not found then
    raise exception 'submission % not found', p_id;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'submission % is not pending', p_id;
  end if;

  -- Status flips to approved before the delete: if the student was
  -- already removed some other way between submission and approval,
  -- v_row.student_id being null here is a no-op delete, not an error --
  -- the request is still legitimately "approved", there's just nothing
  -- left to do.
  update student_delete_submission
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_id;

  if v_row.student_id is not null then
    delete from student where id = v_row.student_id;
  end if;
end;
$$;

grant execute on function approve_student_delete(uuid) to authenticated;
