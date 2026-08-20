create index fee_account_year_service_status_idx
  on fee_account (academic_year_id, service_type, status);

create index fee_account_student_idx on fee_account (student_id);

create index payment_fee_account_idx on payment (fee_account_id);

create index payment_paid_on_idx on payment (paid_on);

create index student_branch_idx on student (branch_id);

create index student_full_name_trgm_idx on student using gin (full_name gin_trgm_ops);
