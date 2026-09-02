-- 20260825000005 fixed every FK that references student/fee_account directly,
-- but missed one hop further down the cascade chain: deleting a student
-- cascades to fee_account, which cascades to payment (20260825000001) --
-- and payment_submission.created_payment_id references payment with no
-- cascade/set-null behavior. A student with an approved payment submission
-- still blocks a hard delete with a foreign key violation on payment_submission,
-- one table later than the previous migration checked.
--
-- Same audit-preserving reasoning as before: the submission row proves an
-- admin approved this payment: on delete set null, not cascade.

alter table payment_submission
  drop constraint payment_submission_created_payment_id_fkey,
  add constraint payment_submission_created_payment_id_fkey
    foreign key (created_payment_id) references payment (id) on delete set null;
