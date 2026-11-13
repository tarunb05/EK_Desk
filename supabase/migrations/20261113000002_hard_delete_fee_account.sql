-- Admin-only hard delete of ONE enrollment (a fee_account): the row and what
-- hangs off it -- its payments, payment requests and their claims -- leave the
-- database, while the student and their other enrollments stay exactly as
-- they are. The Students list's Actions menu offers it per enrollment, next
-- to the existing delete of a whole student.
--
-- Same guard as hard_delete_student (20260923000000): money that arrived
-- should never silently disappear from the record, so an enrollment with a
-- confirmed payment claim can't be deleted, even if its request closed long
-- ago. Same shape too: security definer with the admin check inside the body
-- (bypassing RLS is exactly why that check can't be optional), so no table
-- delete grant is needed and a teacher is refused outright. The foreign keys
-- already cascade (payment, payment_request) or clear themselves
-- (payment_submission, student_edit_submission), so one delete is enough.
create function hard_delete_fee_account(p_fee_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not auth_is_admin() then
    raise exception 'only an admin can delete an enrollment';
  end if;

  if exists (
    select 1
    from payment_claim pc
    join payment_request pr on pr.id = pc.payment_request_id
    where pr.fee_account_id = p_fee_account_id and pc.status = 'confirmed'
  ) then
    raise exception 'this enrollment has a confirmed payment on record and can''t be deleted';
  end if;

  delete from fee_account where id = p_fee_account_id;
  if not found then
    raise exception 'this enrollment no longer exists';
  end if;
end;
$$;

grant execute on function hard_delete_fee_account(uuid) to authenticated;
