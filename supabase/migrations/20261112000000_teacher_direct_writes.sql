-- Teachers now add students, edit them, record payments and void payments
-- directly for their own branch -- no admin approval. Deleting a student
-- still goes through student_delete_submission, and the existing
-- student/edit/payment submission tables stay so an admin can finish
-- whatever was already queued.
--
-- Every write is still recorded by log_activity() (activity_log), so the
-- approval queue's audit role is covered by the log. Scoping is the same
-- as the teacher's existing read policies: their own branch, resolved via
-- auth_role()/auth_branch_id(), never a client-supplied value. Wrapped in
-- (select ...) so each is evaluated once per statement, not per row.

-- student: a teacher may add a student to their own branch.
create policy "teacher inserts own branch" on student
  for insert to authenticated
  with check (
    (select auth_role()) = 'teacher'
    and branch_id = (select auth_branch_id())
  );

-- The existing "teacher updates own branch status" policy already scopes
-- teacher updates to their own branch; its guard trigger limited them to
-- the status column. Teachers now edit the student's details too, so the
-- guard only keeps the branch and admission number fixed -- moving a
-- student to another branch, or renumbering them, stays an admin action.
create or replace function student_enforce_teacher_status_only()
returns trigger
language plpgsql
as $$
begin
  if (select auth_role()) = 'teacher' then
    if new.branch_id <> old.branch_id
      or new.admission_no <> old.admission_no
    then
      raise exception 'a teacher may not change a student''s branch or admission number';
    end if;
  end if;

  return new;
end;
$$;

-- fee_account: add and edit enrollments for their own branch's students.
create policy "teacher inserts own branch" on fee_account
  for insert to authenticated
  with check (
    (select auth_role()) = 'teacher'
    and exists (
      select 1 from student s
      where s.id = fee_account.student_id
        and s.branch_id = (select auth_branch_id())
    )
  );

create policy "teacher updates own branch" on fee_account
  for update to authenticated
  using (
    (select auth_role()) = 'teacher'
    and exists (
      select 1 from student s
      where s.id = fee_account.student_id
        and s.branch_id = (select auth_branch_id())
    )
  )
  with check (
    (select auth_role()) = 'teacher'
    and exists (
      select 1 from student s
      where s.id = fee_account.student_id
        and s.branch_id = (select auth_branch_id())
    )
  );

-- payment: record and void payments for their own branch. The existing
-- payment_append_only_guard trigger still allows only voiding on update,
-- for every role.
create policy "teacher inserts own branch" on payment
  for insert to authenticated
  with check (
    (select auth_role()) = 'teacher'
    and exists (
      select 1 from fee_account fa
      join student s on s.id = fa.student_id
      where fa.id = payment.fee_account_id
        and s.branch_id = (select auth_branch_id())
    )
  );

create policy "teacher voids own branch" on payment
  for update to authenticated
  using (
    (select auth_role()) = 'teacher'
    and exists (
      select 1 from fee_account fa
      join student s on s.id = fa.student_id
      where fa.id = payment.fee_account_id
        and s.branch_id = (select auth_branch_id())
    )
  )
  with check (
    (select auth_role()) = 'teacher'
    and exists (
      select 1 from fee_account fa
      join student s on s.id = fa.student_id
      where fa.id = payment.fee_account_id
        and s.branch_id = (select auth_branch_id())
    )
  );
