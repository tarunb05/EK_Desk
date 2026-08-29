-- Phase 12.1: the Activity log's capture layer -- table, one trigger
-- function on seven tables, RLS, and the seeded first row. No page yet
-- (12.2). See the CLAUDE.md entry this migration's sibling doc-only commit
-- adds for the PII exception this table deliberately takes.

create table activity_log (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  txid             bigint      not null default txid_current(),
  actor_id         uuid        references profile (id),  -- null = system / seed / migration
  actor_label      text        not null,                 -- snapshot; survives deactivation
  actor_role       text,                                 -- snapshot at the time of the action
  action           text        not null check (action in ('create', 'update', 'delete')),
  entity           text        not null check (entity in (
                     'student', 'fee_account', 'payment', 'expense',
                     'expense_category', 'student_submission', 'profile',
                     -- Not a real domain entity -- reserved for the one
                     -- migration-seeded bootstrap row below, so the empty
                     -- state has a floor date without inventing a fake
                     -- student/expense/etc. row to hang it on.
                     'system'
                   )),
  entity_id        uuid,                                 -- may point at a row that is gone
  entity_label     text        not null,                 -- snapshot: 'Aarav Sharma', 'Grocery'
  branch_id        uuid        references branch (id),
  academic_year_id uuid        references academic_year (id),
  summary          text        not null,                 -- one sentence, rendered as-is, no money
  changed_fields   text[],                                -- column names only, updates only
  -- Deliberately two typed columns instead of a generic `amount_paise`
  -- delta or a before/after jsonb blob (see the phase-12 plan's answer to
  -- "changed_fields only, or old and new values too?"): this answers "how
  -- much did the receivable/expense/payment change by" without ever
  -- putting a guardian phone number or any other free-text field into a
  -- second table that outlives the row it describes.
  before_amount_paise bigint,
  after_amount_paise  bigint
);

-- ponytail: a few hundred students across two branches is low thousands of
-- rows a year. No partitioning, no retention job, no archive table. If
-- this table ever reaches tens of millions of rows (a scale this office is
-- nowhere near), the upgrade path is range-partitioning on occurred_at,
-- not a rewrite of the schema above.
create index activity_log_occurred_at_id on activity_log (occurred_at desc, id desc);
create index activity_log_branch_occurred_at on activity_log (branch_id, occurred_at desc);
create index activity_log_actor_occurred_at on activity_log (actor_id, occurred_at desc);
create index activity_log_entity on activity_log (entity, entity_id);
create index activity_log_txid on activity_log (txid);

alter table activity_log enable row level security;

-- Corrects one detail of the original plan: admin and teacher are the same
-- Postgres role (`authenticated`) in this schema -- role is an
-- application-level column on `profile`, read through auth_is_admin(),
-- never a distinct database role. "No grant at all for teacher" isn't
-- something GRANT/REVOKE can express here (revoking SELECT from
-- `authenticated` would also block the admin who needs it); the achievable
-- equivalent, and the one every other role-scoped table in this schema
-- already uses, is an RLS policy that is unconditionally false for a
-- teacher. The practical guarantee is identical: a teacher's select
-- returns zero rows, always.
grant select on activity_log to authenticated;

create policy "admin reads the log" on activity_log
  for select to authenticated
  using ((select auth_is_admin()));

-- No insert/update/delete grant to `authenticated` at all -- not even
-- admin. This is what makes the table unforgeable: the trigger function
-- below is `security definer`, so it inserts as its owner regardless of
-- the grants above, and there is no policy path, admin or otherwise, that
-- could ever reach an UPDATE or DELETE on this table.

create function log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_actor_label text;
  v_actor_role text;
  v_action text;
  v_entity_id uuid;
  v_entity_label text;
  v_branch_id uuid;
  v_academic_year_id uuid;
  v_summary text;
  v_changed_fields text[];
  v_before_amount bigint;
  v_after_amount bigint;
  v_old_clean jsonb;
  v_new_clean jsonb;
begin
  -- auth.uid() reads a per-request GUC PostgREST sets from the JWT once at
  -- the start of the request; it is not derived from the executing
  -- Postgres role, so it resolves to the real acting user even when this
  -- trigger fires from inside a `security definer` function like
  -- approve_student_submission or approve_student_delete. Verified in
  -- submissions.integration.test.ts, not assumed.
  v_actor_id := auth.uid();
  if v_actor_id is not null then
    select full_name, role into v_actor_label, v_actor_role
    from public.profile where id = v_actor_id;
  end if;
  if v_actor_label is null then
    v_actor_label := 'System';
  end if;

  v_action := case TG_OP
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
  end;

  -- changed_fields and the no-op guard, UPDATE only. updated_at (and
  -- updated_by, on the tables that have one) are stripped before
  -- comparing: both change on every save regardless of whether any real
  -- field did, so leaving them in would make a resubmitted-unchanged form
  -- look like an edit and would defeat the no-op check entirely.
  if TG_OP = 'UPDATE' then
    v_old_clean := to_jsonb(old) - 'updated_at' - 'updated_by';
    v_new_clean := to_jsonb(new) - 'updated_at' - 'updated_by';
    if v_old_clean = v_new_clean then
      return null; -- AFTER trigger; the return value is ignored either way
    end if;
    select array_agg(n.key) into v_changed_fields
    from jsonb_each(v_new_clean) as n(key, value)
    where v_new_clean -> n.key is distinct from v_old_clean -> n.key;
  end if;

  -- `old`/`new` are unassigned (not just null-valued) on the side that
  -- does not apply to this TG_OP -- accessing a field on the wrong one
  -- raises, so every reference below goes through this TG_OP switch
  -- rather than coalesce(new.x, old.x), which would still evaluate new.x
  -- first even on a DELETE.
  v_entity_id := case TG_OP when 'DELETE' then old.id else new.id end;

  if TG_TABLE_NAME = 'student' then
    v_entity_label := case TG_OP when 'DELETE' then old.full_name else new.full_name end;
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_summary := case v_action
      when 'create' then 'Added student ' || v_entity_label
      when 'update' then 'Updated student ' || v_entity_label
      when 'delete' then 'Deleted student ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'fee_account' then
    select s.full_name, s.branch_id into v_entity_label, v_branch_id
    from public.student s
    where s.id = case TG_OP when 'DELETE' then old.student_id else new.student_id end;
    -- A fee_account delete only ever happens as a cascade from its
    -- student's own delete (rule 5: status flips to 'discontinued'
    -- instead, in every other case) -- and cascaded child deletes fire
    -- after the parent row is already gone, not before, so this join
    -- always misses on that path. Falls back rather than leaving
    -- entity_label (and therefore summary, built from it below) null,
    -- which would fail activity_log's own not-null constraint and, since
    -- this function swallows its own errors, silently drop the row
    -- instead of merely degrading its label.
    v_entity_label := coalesce(v_entity_label, 'a student no longer on record');
    v_academic_year_id := case TG_OP when 'DELETE' then old.academic_year_id else new.academic_year_id end;
    v_before_amount := case when TG_OP = 'INSERT' then null else old.total_receivable_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.total_receivable_paise end;
    v_summary := case v_action
      when 'create' then 'Added ' || new.service_type || ' fee account for ' || v_entity_label
      when 'update' then 'Updated ' || new.service_type || ' fee account for ' || v_entity_label
      when 'delete' then 'Removed ' || old.service_type || ' fee account for ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'payment' then
    select s.full_name, s.branch_id, fa.academic_year_id
      into v_entity_label, v_branch_id, v_academic_year_id
    from public.fee_account fa
    join public.student s on s.id = fa.student_id
    where fa.id = case TG_OP when 'DELETE' then old.fee_account_id else new.fee_account_id end;
    -- Same reasoning as fee_account's own fallback above -- a payment
    -- delete only happens as a cascade two levels down from its student's
    -- delete, by which point both the fee_account and the student rows
    -- are already gone.
    v_entity_label := coalesce(v_entity_label, 'a student no longer on record');
    v_before_amount := case when TG_OP = 'INSERT' then null else old.amount_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.amount_paise end;
    v_summary := case
      when v_action = 'create' then 'Recorded a payment for ' || v_entity_label
      -- payment_enforce_append_only (payment_append_only_guard) already
      -- guarantees the only UPDATE Postgres will ever accept on this table
      -- is a void, so there is no other case to distinguish here -- this
      -- is the single most important line this table will ever hold.
      when v_action = 'update' then 'Voided a payment for ' || v_entity_label
        || coalesce(' — ' || new.void_reason, '')
      -- No app code path deletes a payment directly (append-only, no
      -- delete grant) -- the only way this branch runs is as the second
      -- level of a student's cascade delete, and it still needs a
      -- non-null summary or the whole insert fails silently (see this
      -- function's exception handler).
      when v_action = 'delete' then 'Removed a payment for ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'expense' then
    select c.name into v_entity_label
    from public.expense_category c
    where c.id = case TG_OP when 'DELETE' then old.category_id else new.category_id end;
    -- expense_category has an on delete restrict FK from expense (a used
    -- category is never hard-deleted, only deactivated), so this lookup
    -- should never actually miss -- the fallback is defensive, not a case
    -- this schema is expected to hit.
    v_entity_label := coalesce(v_entity_label, 'an unknown category');
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_academic_year_id := case TG_OP when 'DELETE' then old.academic_year_id else new.academic_year_id end;
    v_before_amount := case when TG_OP = 'INSERT' then null else old.amount_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.amount_paise end;
    v_summary := case v_action
      when 'create' then 'Recorded an expense in ' || v_entity_label
      when 'update' then 'Updated an expense in ' || v_entity_label
      when 'delete' then 'Deleted an expense in ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'expense_category' then
    v_entity_label := case TG_OP when 'DELETE' then old.name else new.name end;
    v_summary := case v_action
      when 'create' then 'Added category ' || v_entity_label
      when 'update' then 'Updated category ' || v_entity_label
      when 'delete' then 'Deleted category ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'student_submission' then
    v_entity_label := case TG_OP when 'DELETE' then old.full_name else new.full_name end;
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_academic_year_id := case TG_OP when 'DELETE' then old.academic_year_id else new.academic_year_id end;
    v_before_amount := case when TG_OP = 'INSERT' then null else old.total_receivable_paise end;
    v_after_amount := case when TG_OP = 'DELETE' then null else new.total_receivable_paise end;
    v_summary := case
      when v_action = 'create' then 'Submitted a ' || new.service_type || ' request for ' || v_entity_label
      when v_action = 'update' and new.status = 'approved' and old.status = 'pending'
        then 'Approved the ' || new.service_type || ' request for ' || v_entity_label
      when v_action = 'update' and new.status = 'rejected' and old.status = 'pending'
        then 'Rejected the ' || new.service_type || ' request for ' || v_entity_label
          || coalesce(' — ' || new.review_note, '')
      when v_action = 'update' then 'Updated the request for ' || v_entity_label
      when v_action = 'delete' then 'Removed the request for ' || v_entity_label
    end;

  elsif TG_TABLE_NAME = 'profile' then
    v_entity_label := case TG_OP when 'DELETE' then old.full_name else new.full_name end;
    v_branch_id := case TG_OP when 'DELETE' then old.branch_id else new.branch_id end;
    v_summary := case
      when v_action = 'create' then 'Added user ' || v_entity_label
      when v_action = 'update' and new.role is distinct from old.role
        then 'Changed ' || v_entity_label || '''s role to ' || new.role
      when v_action = 'update' and new.is_active = false and old.is_active = true
        then 'Deactivated user ' || v_entity_label
      when v_action = 'update' and new.is_active = true and old.is_active = false
        then 'Reactivated user ' || v_entity_label
      when v_action = 'update' then 'Updated user ' || v_entity_label
      when v_action = 'delete' then 'Removed user ' || v_entity_label
    end;
  end if;

  if v_entity_label is null then
    v_entity_label := 'Unknown';
  end if;

  insert into public.activity_log (
    actor_id, actor_label, actor_role, action, entity, entity_id, entity_label,
    branch_id, academic_year_id, summary, changed_fields,
    before_amount_paise, after_amount_paise
  ) values (
    v_actor_id, v_actor_label, v_actor_role, v_action, TG_TABLE_NAME, v_entity_id, v_entity_label,
    v_branch_id, v_academic_year_id, v_summary, v_changed_fields,
    v_before_amount, v_after_amount
  );

  return null; -- AFTER trigger; the return value is ignored either way
exception
  -- The trigger must never be able to fail the mutation it is capturing --
  -- a payment or a delete failing because the audit table hiccuped is a
  -- catastrophic trade for an audit feature. Swallow and continue; the gap
  -- is visible in Postgres's own log via the warning, which is a
  -- noticeable, fixable hole, unlike a blocked payment.
  when others then
    raise warning 'activity_log: logging failed for % on % (%): %',
      TG_OP, TG_TABLE_NAME, coalesce(v_entity_id::text, 'unknown'), sqlerrm;
    return null;
end;
$$;

create trigger activity_log_student
  after insert or update or delete on student
  for each row execute function log_activity();

create trigger activity_log_fee_account
  after insert or update or delete on fee_account
  for each row execute function log_activity();

create trigger activity_log_payment
  after insert or update or delete on payment
  for each row execute function log_activity();

create trigger activity_log_expense
  after insert or update or delete on expense
  for each row execute function log_activity();

create trigger activity_log_expense_category
  after insert or update or delete on expense_category
  for each row execute function log_activity();

create trigger activity_log_student_submission
  after insert or update or delete on student_submission
  for each row execute function log_activity();

create trigger activity_log_profile
  after insert or update or delete on profile
  for each row execute function log_activity();

-- The one seeded row: gives the empty state a floor date to name ("This
-- log starts from ...") without synthesising any history from existing
-- created_at columns, which would be a fabricated audit trail.
insert into activity_log (actor_id, actor_label, actor_role, action, entity, entity_id, entity_label, summary)
values (null, 'System', null, 'create', 'system', null, 'Activity log', 'Activity logging enabled');
