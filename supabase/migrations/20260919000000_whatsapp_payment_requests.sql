-- Phase 15.1: WhatsApp fee requests, verified by hand -- schema, RLS, and
-- the public token-lookup function only. No gateway is involved: an admin
-- asks a parent for money on WhatsApp, the parent pays the school directly
-- by UPI/bank transfer, and nothing a parent submits ever becomes a
-- `payment` row by itself -- only an admin who has checked the bank can
-- confirm one (that confirm transaction is 15.5's job; this migration just
-- lays the tables and access rules it will run inside).

-- The school's own collection accounts (settings, admin-only). The
-- highest-risk table in this phase -- if someone changes the UPI id, every
-- fee goes to them -- so every write here also lands a row in
-- collection_account_change_log (written by the 15.2 edit action itself,
-- not a trigger, so the log row can carry an already-masked account number
-- rather than a full one ever touching a second table).
create table collection_account (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branch (id),
  label text not null,
  upi_id text,
  payee_name text not null,
  bank_name text,
  account_holder text,
  account_number text,
  ifsc text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  updated_by uuid not null references profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collection_account_has_upi_or_bank check (
    upi_id is not null or account_number is not null
  )
);

-- One default collection account per branch.
create unique index collection_account_one_default_per_branch
  on collection_account (branch_id)
  where is_default;

create index collection_account_branch_id on collection_account (branch_id);

create table payment_request (
  id uuid primary key default gen_random_uuid(),
  -- on delete cascade: a student with only an open/cancelled/closed request
  -- (no confirmed claim) is still hard-deletable (answer 5), and deleting
  -- them cascades through fee_account already (hard_delete_student
  -- migration) -- this has to follow, or that cascade hits a bare FK
  -- violation the moment any request ever existed for the account.
  fee_account_id uuid not null references fee_account (id) on delete cascade,
  collection_account_id uuid not null references collection_account (id),
  reference_code text not null unique,
  amount_paise bigint not null check (amount_paise > 0),
  include_upi boolean not null,
  include_bank boolean not null,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  closed_reason text check (
    closed_reason in ('paid', 'pending_cleared', 'expired', 'cancelled', 'account_changed')
  ),
  -- sha256 of the pay-page token -- only the hash is ever stored, so a
  -- database leak exposes no working pay links (brief section 3).
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  shared_at timestamptz,
  shared_via text check (shared_via in ('whatsapp', 'sms', 'copied')),
  shared_to_last4 text,
  created_by uuid not null references profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_request_closed_reason_matches_status check (
    (status = 'open') = (closed_reason is null)
  )
);

-- One open request per fee account.
create unique index payment_request_one_open_per_fee_account
  on payment_request (fee_account_id)
  where status = 'open';

create index payment_request_fee_account_id on payment_request (fee_account_id);
create index payment_request_collection_account_id on payment_request (collection_account_id);

create table payment_claim (
  id uuid primary key default gen_random_uuid(),
  -- on delete cascade, same reasoning as payment_request.fee_account_id
  -- above -- a cascade-deleted request's own (necessarily unconfirmed,
  -- given answer 5's hard-delete guard) claims go with it.
  payment_request_id uuid not null references payment_request (id) on delete cascade,
  source text not null check (source in ('parent_page', 'admin_entered')),
  utr text not null,
  claimed_amount_paise bigint not null check (claimed_amount_paise > 0),
  claimed_paid_on date not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_by uuid references profile (id),
  reviewed_at timestamptz,
  reject_reason text,
  payment_id uuid references payment (id),
  created_at timestamptz not null default now(),
  constraint payment_claim_review_matches_status check (
    (status = 'pending') = (reviewed_by is null and reviewed_at is null)
  )
);

-- A UTR can only be confirmed once, across the whole system -- a duplicate
-- pending claim is allowed (flagged in the admin queue, brief section 4),
-- but two confirmed payments against the same UTR never are.
create unique index payment_claim_utr_confirmed_once
  on payment_claim (utr)
  where status = 'confirmed';

create index payment_claim_payment_request_id on payment_claim (payment_request_id);
create index payment_claim_status on payment_claim (status);

-- The collection-account audit trail. A bespoke table, not a reuse of
-- activity_log: activity_log's entity_label is a single free-text
-- snapshot string (built so a deleted student's name still renders), and
-- this needs a structured, masked, multi-field before/after diff instead --
-- same shape as expense_delete_log (20260827000000), not activity_log.
-- before/after are written with account_number already masked to its last
-- 4 digits by the 15.2 action, before this row is ever inserted -- masked
-- at write time, so the full number is never at rest here.
create table collection_account_change_log (
  id uuid primary key default gen_random_uuid(),
  collection_account_id uuid not null,
  actor uuid not null references profile (id),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index collection_account_change_log_account_id
  on collection_account_change_log (collection_account_id);

-- student: the WhatsApp number, if different from the primary phone, plus
-- one "not on WhatsApp" flag per number -- either can independently turn
-- out to be off WhatsApp, and the request dialog needs to remember which.
alter table student add column whatsapp_phone text;
alter table student add column phone_not_on_whatsapp_at timestamptz;
alter table student add column whatsapp_phone_not_on_whatsapp_at timestamptz;

-- payment.method: widen to add 'card' (office POS payments), the one new
-- method this phase introduces. expense.method and payment_submission.method
-- stay on the original four -- 'card' only ever means money coming in,
-- recorded directly by an admin, never something the school spent or
-- something a teacher submits for approval (see money.ts's PAYMENT_METHODS
-- vs MONEY_METHODS split).
alter table payment drop constraint payment_method_check;
alter table payment add constraint payment_method_check
  check (method in ('cash', 'upi', 'cheque', 'bank_transfer', 'card'));

-- A non-voided UPI payment's reference can't repeat -- paired with the
-- `|| null` fix in recordPayment/the teacher-submission insert (a blank
-- field used to store '', which would collide with itself; NULL never
-- does). NULL values (most manually-recorded UPI payments predate having a
-- UTR habit at all) are correctly never treated as colliding by a standard
-- unique index.
create unique index payment_reference_unique_upi_non_voided
  on payment (reference)
  where method = 'upi' and voided_at is null;

-- RLS: all four new tables are admin-only, no teacher policy at all --
-- following the stricter standard this app already uses for money reads
-- that go beyond "what a teacher's own branch can see" (payment_request
-- is closer to collection_account here: fraud-adjacent, not a students-list
-- figure).
alter table collection_account enable row level security;
alter table payment_request enable row level security;
alter table payment_claim enable row level security;
alter table collection_account_change_log enable row level security;

grant select, insert, update on collection_account to authenticated;
grant select, insert, update on payment_request to authenticated;
grant select, insert, update on payment_claim to authenticated;
grant select, insert on collection_account_change_log to authenticated;

create policy "admin full access" on collection_account
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "admin full access" on payment_request
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "admin full access" on payment_claim
  for all to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

create policy "admin reads change log" on collection_account_change_log
  for select to authenticated
  using (auth_is_admin());

-- Same convention as expense_delete_log's "logs its own actor": whoever
-- made the change (already gated to admin by the collection_account policy
-- above) may log that they did it, but only ever as themselves.
create policy "logs its own actor" on collection_account_change_log
  for insert to authenticated
  with check (actor = auth.uid());

-- The public pay page's one entry point. security definer so it can read
-- past RLS in a tightly-scoped way for an anonymous caller -- the anon role
-- gets no grant on any of the four tables above, only execute on this
-- function, which declares its exact output columns once, in SQL. This is
-- the same pattern this schema already uses everywhere else it needs a
-- controlled elevated read (auth_role(), auth_branch_id(), auth_is_admin()),
-- not the service-role client (src/lib/supabase/admin.ts) -- that client's
-- own comment states its invariant plainly ("every caller must already have
-- gone through requireRole('admin') first"), and this is the one caller
-- that never does.
--
-- Returns the identical shape for an unknown, expired, closed, and
-- cancelled token (all become status <> 'open' or a null row from the
-- caller's perspective) -- the page-level "collapse to one generic
-- message, similar timing" logic is 15.4's job; this function just doesn't
-- leak a distinguishing shape for it to work with.
create function lookup_payment_request_by_token_hash(p_token_hash bytea)
returns table (
  branch_name text,
  service_type text,
  child_first_name text,
  amount_paise bigint,
  expires_at timestamptz,
  reference_code text,
  payee_name text,
  upi_id text,
  include_upi boolean,
  include_bank boolean,
  bank_name text,
  account_holder text,
  account_number text,
  ifsc text,
  status text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    b.name as branch_name,
    fa.service_type,
    split_part(s.full_name, ' ', 1) as child_first_name,
    pr.amount_paise,
    pr.expires_at,
    pr.reference_code,
    ca.payee_name,
    ca.upi_id,
    pr.include_upi,
    pr.include_bank,
    ca.bank_name,
    ca.account_holder,
    ca.account_number,
    ca.ifsc,
    pr.status
  from payment_request pr
  join fee_account fa on fa.id = pr.fee_account_id
  join student s on s.id = fa.student_id
  join branch b on b.id = s.branch_id
  join collection_account ca on ca.id = pr.collection_account_id
  where pr.token_hash = p_token_hash
$$;

grant execute on function lookup_payment_request_by_token_hash(bytea) to anon;
grant execute on function lookup_payment_request_by_token_hash(bytea) to authenticated;
