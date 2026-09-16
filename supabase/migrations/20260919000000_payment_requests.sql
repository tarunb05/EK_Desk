-- Phase 15.1: schema for Razorpay payment links. Admin creates a link for
-- a fee account, a parent pays it on Razorpay's hosted page, a webhook
-- (Phase 15.3) inserts the resulting `payment` row. This migration is
-- schema/RLS only -- no Server Actions, no webhook route, no UI yet.

create table payment_request (
  id uuid primary key default gen_random_uuid(),
  -- on delete cascade to match fee_account.student_id and
  -- payment.fee_account_id (both already cascade, added specifically for
  -- permanentlyDeleteStudent -- see 20260825000001_hard_delete_student.sql)
  -- -- without this, hard-deleting a student blows up with a foreign-key
  -- violation the moment their fee account has ANY payment_request row
  -- against it, including a merely cancelled one that was never paid, not
  -- just a real gateway payment (which is blocked earlier, deliberately,
  -- at the application layer -- see permanentlyDeleteStudent's own
  -- gateway-payment check).
  fee_account_id uuid not null references fee_account (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled', 'expired')),
  gateway text not null default 'razorpay',
  gateway_link_id text unique,
  short_url text,
  expires_at timestamptz not null,
  created_by uuid not null references profile (id),
  -- "shared", never "delivered" -- WhatsApp click-to-chat only tells us the
  -- admin pressed Send in their own WhatsApp, never that the message
  -- actually reached the parent (Phase 15 brief).
  shared_via_whatsapp_at timestamptz,
  paid_payment_id uuid references payment (id),
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One open link per fee account at a time -- creating a new one cancels
-- the old one first (in the same Server Action, at Razorpay and here),
-- rather than allowing two simultaneously payable links for one account.
create unique index payment_request_one_open_per_account
  on payment_request (fee_account_id)
  where status = 'open';

create index payment_request_status on payment_request (status);

-- Idempotency ledger for the webhook (15.3): insert this row first, inside
-- the same transaction as everything else the event does. A primary-key
-- conflict on event_id means "already processed" and the handler returns
-- 200 without touching payment_request/payment again. No RLS policies at
-- all -- only the service-role webhook handler ever touches this table,
-- same as this schema's own convention for tables no client role should
-- reach (see the grant-only, no-policy pattern already used nowhere else
-- in this app until now, since every other table has at least a teacher
-- or admin policy).
create table webhook_event (
  event_id text primary key,
  received_at timestamptz not null default now(),
  event_type text not null
);

alter table payment add column source text not null default 'manual' check (source in ('manual', 'gateway'));
alter table payment add column gateway_payment_id text;
create unique index payment_gateway_payment_id_unique
  on payment (gateway_payment_id)
  where gateway_payment_id is not null;
alter table payment add column payment_request_id uuid references payment_request (id);

-- Razorpay reports upi, netbanking, card and wallet -- upi already fits
-- the existing union (shared with expense.method, which stays untouched:
-- these are two independent per-table CHECK constraints, not a shared
-- type, so widening this one doesn't put "card" into the expense form).
-- recorded_by is untouched: it's already plain text (not a profile FK --
-- confirmed against the initial_schema migration), so a gateway payment
-- just gets the literal string 'Razorpay (online)' from the webhook, the
-- same way approve_payment_submission already falls back to the literal
-- 'Teacher' when a submitter's real name can't be resolved. No schema
-- change needed for that column at all.
alter table payment drop constraint payment_method_check;
alter table payment add constraint payment_method_check
  check (method in ('cash', 'upi', 'cheque', 'bank_transfer', 'netbanking', 'card', 'wallet'));

alter table payment_request enable row level security;
alter table webhook_event enable row level security;

grant select, insert, update on payment_request to authenticated;
-- No grant to authenticated on webhook_event at all -- only the
-- service-role webhook handler ever writes it, and nothing in the app
-- ever needs to read it back.

-- Admin-only, every operation, no teacher policy at all -- unlike
-- student/fee_account/payment (rule 6: a teacher reads their own branch's
-- figures), a payment LINK is an admin-initiated action end to end, and
-- Phase 9's "the server never selects money for a teacher" gets applied
-- here as a genuinely new, stricter standard for this feature (it isn't
-- actually how the Students list itself works today -- checked).
create policy "admin full access" on payment_request
  for all to authenticated
  using ((select auth_is_admin()))
  with check ((select auth_is_admin()));
