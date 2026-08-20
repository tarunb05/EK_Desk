-- payment is append-only: the only permitted change to an existing row is
-- voiding it once (setting voided_at + void_reason). Every other column,
-- and voiding twice, is rejected at the database level so this holds
-- regardless of which application code path writes to the table.
create function payment_enforce_append_only()
returns trigger
language plpgsql
as $$
begin
  if old.voided_at is not null then
    raise exception 'payment % is already voided and cannot be modified', old.id;
  end if;

  if new.fee_account_id <> old.fee_account_id
    or new.amount_paise <> old.amount_paise
    or new.paid_on <> old.paid_on
    or new.method <> old.method
    or new.recorded_by <> old.recorded_by
    or coalesce(new.reference, '') <> coalesce(old.reference, '')
    or coalesce(new.note, '') <> coalesce(old.note, '')
  then
    raise exception 'payment rows are append-only; only voiding is permitted';
  end if;

  return new;
end;
$$;

create trigger payment_append_only_guard
  before update on payment
  for each row
  execute function payment_enforce_append_only();
