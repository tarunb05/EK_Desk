-- Admin-only hard delete of a student: the row and everything hanging off
-- it (fee accounts, payments) leaves the database, no tombstone. This is
-- deliberately a different, additional capability from archiveStudent
-- (student.status = 'inactive', reversible, keeps history) -- callers pick
-- one or the other, they're not the same action.

-- Neither FK cascades today (both default to NO ACTION), so a DELETE on
-- student would just fail with a foreign-key violation the moment a
-- student has any fee_account row. Both columns are already indexed
-- (fee_account_student_idx, payment_fee_account_idx from the very first
-- migration), so the cascade itself is cheap once it's actually allowed.
alter table fee_account drop constraint fee_account_student_id_fkey;
alter table fee_account add constraint fee_account_student_id_fkey
  foreign key (student_id) references student (id) on delete cascade;

alter table payment drop constraint payment_fee_account_id_fkey;
alter table payment add constraint payment_fee_account_id_fkey
  foreign key (fee_account_id) references fee_account (id) on delete cascade;

-- student has never had a DELETE grant at all (the original rls_policies
-- migration deliberately left it out -- "records are discontinued via
-- status columns, never removed"). Adding it now, admin-only: the existing
-- "admin full access" policy is already `for all`, so it already covers
-- DELETE the moment the table-level grant exists to reach it. A teacher
-- gets no grant here, same as before -- not an RLS policy that returns
-- false, no grant at all, matching the least-privilege pattern used
-- elsewhere in this schema. fee_account/payment need no grant of their own:
-- Postgres performs an ON DELETE CASCADE as the constraint action, not as a
-- second DELETE statement subject to the caller's own table privileges.
grant delete on student to authenticated;
