-- Settings' "Delete" on a teacher archives them (profile.is_active =
-- false) rather than deleting the row -- the profile, and everything that
-- references it (student_submission/student_edit_submission/
-- payment_submission.submitted_by, expense.created_by/updated_by,
-- activity_log.actor_id), stays exactly as it was. This migration is the
-- one piece of that archival behaviour that lives in the database rather
-- than the Server Action: profile_full_name() is called by the
-- expense_record view (20260826000001) to resolve a teacher's name past
-- RLS, and every live caller of it should read "Teacher (Deleted)" once
-- that teacher is deactivated, instead of silently continuing to show a
-- name with no working login behind it.
--
-- activity_log.actor_label is deliberately NOT changed by this and never
-- calls this function -- it's a snapshot taken at write time (see that
-- table's own column comment: "survives deactivation"), the historical
-- record of who did something at the time they did it, not a live lookup.
create or replace function profile_full_name(p_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case when is_active then full_name else 'Teacher (Deleted)' end
  from profile
  where id = p_id
$$;
