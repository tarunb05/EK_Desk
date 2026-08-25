-- 20260825000001_hard_delete_student.sql added `on delete cascade` for
-- fee_account/payment, but missed the submission audit tables -- any
-- student created or edited via an approved teacher submission still has a
-- row in student_submission.created_student_id / student_edit_submission
-- (student_id, fee_account_id) with no cascade/set-null behavior, so
-- deleting that student fails with a foreign key violation.
--
-- Following the same audit-trail-preserving pattern already used for
-- student_delete_submission.student_id: these submission rows are a
-- historical record of who submitted what and who approved it, and that
-- history should survive the student being hard-deleted later. So this is
-- `on delete set null`, not cascade -- deleting the submission rows would
-- destroy the approval audit trail for no reason.

-- student_submission_approved_is_complete required created_student_id to
-- stay non-null forever once approved -- that's incompatible with ever
-- setting it null, since ON DELETE SET NULL performs a real UPDATE that's
-- re-checked against every CHECK constraint on the row. The invariant it
-- protects ("approval always produced a student") only needs to hold at
-- approval time, not after that student is later, legitimately deleted.
alter table student_submission
  drop constraint student_submission_approved_is_complete,
  add constraint student_submission_approved_is_complete check (
    status <> 'approved' or reviewed_by is not null
  ),
  drop constraint student_submission_created_student_id_fkey,
  add constraint student_submission_created_student_id_fkey
    foreign key (created_student_id) references student (id) on delete set null;

alter table student_edit_submission
  alter column student_id drop not null,
  alter column fee_account_id drop not null,
  drop constraint student_edit_submission_student_id_fkey,
  add constraint student_edit_submission_student_id_fkey
    foreign key (student_id) references student (id) on delete set null,
  drop constraint student_edit_submission_fee_account_id_fkey,
  add constraint student_edit_submission_fee_account_id_fkey
    foreign key (fee_account_id) references fee_account (id) on delete set null;

-- fee_account itself cascades from student (20260825000001), so
-- payment_submission.fee_account_id needs the same treatment or a student
-- delete would still fail trying to cascade-delete their fee_account rows.
alter table payment_submission
  alter column fee_account_id drop not null,
  drop constraint payment_submission_fee_account_id_fkey,
  add constraint payment_submission_fee_account_id_fkey
    foreign key (fee_account_id) references fee_account (id) on delete set null;
