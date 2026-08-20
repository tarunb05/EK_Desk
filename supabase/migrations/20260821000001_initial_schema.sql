-- Core schema: branch, academic_year, student, fee_account, payment.
-- See CLAUDE.md "Domain model" for the non-negotiable rules this encodes.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table branch (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academic_year (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_year_ends_after_starts check (ends_on > starts_on)
);

create table student (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branch (id),
  admission_no text not null,
  full_name text not null,
  guardian_name text not null,
  phone text not null,
  class_section text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_admission_no_unique_per_branch unique (branch_id, admission_no)
);

create table fee_account (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student (id),
  academic_year_id uuid not null references academic_year (id),
  service_type text not null check (service_type in ('transport', 'daycare')),
  total_receivable_paise bigint not null check (total_receivable_paise >= 0),
  due_date date not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'discontinued')),
  route_name text,
  pickup_point text,
  slot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_account_ends_after_starts check (ends_on >= starts_on),
  -- One table serves both services; these columns are mutually exclusive
  -- by service_type so the aggregation logic never has to branch on it.
  constraint fee_account_service_columns check (
    (service_type = 'transport' and slot is null)
    or
    (service_type = 'daycare' and route_name is null and pickup_point is null)
  )
);

create table payment (
  id uuid primary key default gen_random_uuid(),
  fee_account_id uuid not null references fee_account (id),
  amount_paise bigint not null check (amount_paise >= 0),
  paid_on date not null,
  method text not null check (method in ('cash', 'upi', 'cheque', 'bank_transfer')),
  reference text,
  note text,
  recorded_by text not null,
  voided_at timestamptz,
  void_reason text,
  constraint payment_void_reason_requires_voided_at check (
    (voided_at is null) = (void_reason is null)
  )
);
