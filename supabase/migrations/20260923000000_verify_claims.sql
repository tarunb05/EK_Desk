-- Phase 15.5: the confirm/reject transaction that finally closes the loop
-- -- nothing a parent submitted has become a `payment` row until now.
-- Everything here is admin-only; payment_request/payment_claim/
-- collection_account already carry a "for all to authenticated using
-- (auth_is_admin())" policy from 15.1, so the read side (the queue's own
-- listing) needs no new function -- only the multi-step writes do.

-- The one new write: lock the claim, re-check it's still pending, insert
-- the real payment (through the same "recorded_by is a resolved name, not
-- a raw uuid" shape approve_payment_submission already uses, since
-- payment.recorded_by has been plain text since Phase 4, long before the
-- profile/role system existed), mark the claim confirmed, close the
-- request if the admin chose to, and reject any other pending claim
-- sharing the same UTR. One function, one transaction, same shape as
-- create_payment_request/approve_payment_submission.
create function confirm_payment_claim(
  p_claim_id uuid,
  p_received_amount_paise bigint,
  p_received_paid_on date,
  p_method text,
  p_close_request boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim payment_claim%rowtype;
  v_request payment_request%rowtype;
  v_admin_name text;
  v_payment_id uuid;
  v_request_status text;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can confirm a claim';
  end if;
  if p_method not in ('upi', 'bank_transfer') then
    raise exception 'invalid method';
  end if;
  if p_received_amount_paise <= 0 then
    raise exception 'invalid amount';
  end if;

  select * into v_claim from payment_claim where id = p_claim_id for update;
  if not found then
    raise exception 'claim % not found', p_claim_id;
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'this claim has already been reviewed';
  end if;

  select * into v_request from payment_request where id = v_claim.payment_request_id;

  select full_name into v_admin_name from profile where id = auth.uid();

  begin
    insert into payment
      (fee_account_id, amount_paise, paid_on, method, reference, note, recorded_by)
    values
      (v_request.fee_account_id, p_received_amount_paise, p_received_paid_on,
       p_method, v_claim.utr, 'Ref ' || v_request.reference_code,
       coalesce(v_admin_name, 'Admin'))
    returning id into v_payment_id;
  exception when unique_violation then
    raise exception 'this reference has already been recorded as a payment';
  end;

  begin
    update payment_claim
    set status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(),
        payment_id = v_payment_id
    where id = p_claim_id;
  exception when unique_violation then
    raise exception 'this UTR has already been confirmed against another claim';
  end;

  if p_close_request then
    update payment_request
    set status = 'closed', closed_reason = 'paid', updated_at = now()
    where id = v_request.id and status = 'open';
  end if;

  -- A different claim sharing this UTR is now provably a duplicate --
  -- reject it automatically rather than leaving it in the queue for a
  -- second admin to confirm and hit the same unique-index failure.
  update payment_claim
  set status = 'rejected', reject_reason = 'a different claim with this UTR was confirmed',
      reviewed_by = auth.uid(), reviewed_at = now()
  where utr = v_claim.utr and status = 'pending' and id <> p_claim_id;

  select status into v_request_status from payment_request where id = v_request.id;

  return jsonb_build_object('paymentId', v_payment_id, 'requestStatus', v_request_status);
end;
$$;

grant execute on function confirm_payment_claim(uuid, bigint, date, text, boolean) to authenticated;

-- "The admin can also enter a claim from a WhatsApp reply (source
-- admin_entered) and confirm it in the same step" -- one insert plus the
-- exact same confirm logic as above, factored so it isn't duplicated: this
-- inserts the claim, then reuses confirm_payment_claim on the row it just
-- created, in the same transaction.
create function enter_and_confirm_claim(
  p_payment_request_id uuid,
  p_utr text,
  p_claimed_amount_paise bigint,
  p_claimed_paid_on date,
  p_received_amount_paise bigint,
  p_received_paid_on date,
  p_method text,
  p_close_request boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim_id uuid;
begin
  if not auth_is_admin() then
    raise exception 'only an admin can enter a claim';
  end if;
  if p_claimed_amount_paise <= 0 then
    raise exception 'invalid amount';
  end if;

  insert into payment_claim
    (payment_request_id, source, utr, claimed_amount_paise, claimed_paid_on)
  values
    (p_payment_request_id, 'admin_entered', p_utr, p_claimed_amount_paise, p_claimed_paid_on)
  returning id into v_claim_id;

  return confirm_payment_claim(
    v_claim_id, p_received_amount_paise, p_received_paid_on, p_method, p_close_request
  );
end;
$$;

grant execute on function enter_and_confirm_claim(
  uuid, text, bigint, date, bigint, date, text, boolean
) to authenticated;

-- Phase 9's delete-student flow never had a domain check at all -- a plain
-- client .delete() relying only on the admin RLS policy and the cascade
-- FKs. Money that arrived should never silently disappear from the record
-- the same way a payment row itself never can (CLAUDE.md rule 2's own
-- reasoning, extended to this) -- block hard-deleting a student who has
-- any confirmed claim, even if that claim's own request is long closed.
create function hard_delete_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not auth_is_admin() then
    raise exception 'only an admin can delete a student';
  end if;

  if exists (
    select 1
    from payment_claim pc
    join payment_request pr on pr.id = pc.payment_request_id
    join fee_account fa on fa.id = pr.fee_account_id
    where fa.student_id = p_student_id and pc.status = 'confirmed'
  ) then
    raise exception 'this student has a confirmed payment on record and can''t be deleted';
  end if;

  delete from student where id = p_student_id;
  if not found then
    raise exception 'this student no longer exists';
  end if;
end;
$$;

grant execute on function hard_delete_student(uuid) to authenticated;

-- Students-list markers ("Request open" / "Payment reported"): one more
-- field per fee_accounts array entry, same shape as the 15.3-era view.
create or replace view student_directory
with (security_invoker = true) as
select
  s.id,
  s.full_name,
  s.admission_no,
  s.class_section,
  s.phone,
  s.guardian_name,
  s.status,
  s.created_at,
  b.code as branch_code,
  b.name as branch_name,
  coalesce(agg.fee_account_count, 0) as fee_account_count,
  coalesce(agg.total_pending_paise, 0) as total_pending_paise,
  coalesce(agg.has_overdue, false) as has_overdue,
  coalesce(agg.has_transport, false) as has_transport,
  coalesce(agg.has_daycare, false) as has_daycare,
  coalesce(agg.fee_accounts, '[]'::json) as fee_accounts,
  coalesce(agg.academic_year_ids, array[]::uuid[]) as academic_year_ids
from student s
join branch b on b.id = s.branch_id
left join (
  select
    fab.student_id,
    count(*) as fee_account_count,
    sum(fab.pending_paise) filter (where fab.status = 'active')
      as total_pending_paise,
    bool_or(
      fab.status = 'active'
      and fab.pending_paise > 0
      and fab.due_date < current_date
    ) as has_overdue,
    bool_or(fab.service_type = 'transport') as has_transport,
    bool_or(fab.service_type = 'daycare') as has_daycare,
    json_agg(
      json_build_object(
        'feeAccountId', fab.fee_account_id,
        'serviceType', fab.service_type,
        'academicYearLabel', ay.label,
        'status', fab.status,
        'paymentRequestStatus', case
          when pr.id is null then 'none'
          when exists (
            select 1 from payment_claim pc
            where pc.payment_request_id = pr.id and pc.status = 'pending'
          ) then 'reported'
          else 'open'
        end
      )
      order by fab.service_type, ay.label desc
    ) as fee_accounts,
    array_agg(distinct fab.academic_year_id) as academic_year_ids
  from fee_account_balance fab
  join academic_year ay on ay.id = fab.academic_year_id
  left join payment_request pr
    on pr.fee_account_id = fab.fee_account_id and pr.status = 'open'
  group by fab.student_id
) agg on agg.student_id = s.id;
