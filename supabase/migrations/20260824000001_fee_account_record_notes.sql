-- The edit form now covers the student's own details too (see the
-- submissions migration), including notes -- fee_account_record didn't
-- carry student.notes at all before, so there was nothing to default the
-- field to when opening the edit form on an existing note. Appended at the
-- very end, same as student_status was -- CREATE OR REPLACE VIEW can only
-- add columns after the existing ones, never reorder or insert between them.
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
  s.notes as student_notes
from fee_account_balance fab
join student s on s.id = fab.student_id
join branch b on b.id = s.branch_id;

grant select on fee_account_record to authenticated;
