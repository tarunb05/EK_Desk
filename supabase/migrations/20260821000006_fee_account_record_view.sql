-- Flattens fee_account_balance with the student/branch columns the record
-- tables need to filter, sort, and search by. Transport and daycare both
-- read this same view with a different service_type filter — the join and
-- aggregation logic exists exactly once.
create view fee_account_record
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
  b.name as branch_name
from fee_account_balance fab
join student s on s.id = fab.student_id
join branch b on b.id = s.branch_id;

grant select on fee_account_record to authenticated;
