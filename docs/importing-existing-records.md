# Importing the office's existing records

A one-time path for bringing the office's real, current student/fee/payment
records into this schema. This is about **real student data** — everything
in [`CLAUDE.md`](../CLAUDE.md)'s PII rule applies at every step: it never
enters git, a seed script, a screenshot, or a log line. Do this import
directly against the production Supabase project's SQL editor or a local
`psql`/script session that talks to it — never by adding rows to
`scripts/seed.ts`, which is fake data generation for dev/CI only.

## Overview

The office's records are (as of writing) a spreadsheet per branch per
service, roughly: student roster with fee amounts, plus a running list of
payments received. The import is three ordered passes matching the schema's
foreign keys: `student`, then `fee_account`, then `payment`.

## 1. `branch` and `academic_year`

These almost certainly already exist (created once, by hand, when the app
was first set up — two branches, and the academic year(s) the office is
importing data for). Confirm with:

```sql
select id, code, name from branch;
select id, label, starts_on, ends_on, is_current from academic_year;
```

Note the `id` values — every row imported below references one of these.

## 2. `student`

Map each spreadsheet row to:

| Schema column   | Spreadsheet source                              | Notes                                                                  |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `branch_id`     | which branch tab/sheet                          | from step 1                                                            |
| `admission_no`  | admission number column                         | must be unique per branch (`student_admission_no_unique_per_branch`)   |
| `full_name`     | student name                                    |                                                                        |
| `guardian_name` | parent/guardian name                            |                                                                        |
| `phone`         | contact number                                  | keep as text — do not coerce to a number and lose a leading `0`/`+91`  |
| `class_section` | class + section                                 | free text today (e.g. `"Nursery-A"`) — match the format already seeded |
| `status`        | `'active'` unless the office marks a withdrawal | defaults to `'active'`                                                 |

`notes` is optional; leave null unless there's something worth carrying
over verbatim.

## 3. `fee_account`

One row per student per service the student is enrolled in (a student on
both transport and daycare gets two rows). Map:

| Schema column                      | Spreadsheet source                         | Notes                                                                                                        |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `student_id`                       | the row just inserted                      |                                                                                                              |
| `academic_year_id`                 | from step 1                                |                                                                                                              |
| `service_type`                     | which sheet (`'transport'` or `'daycare'`) |                                                                                                              |
| `total_receivable_paise`           | the fee amount, **in rupees on the sheet** | multiply by 100 and round to an integer — this column is `bigint` paise, never a float (`CLAUDE.md` rule 1). |
| `due_date`, `starts_on`, `ends_on` | term dates on the sheet                    |                                                                                                              |
| `route_name`, `pickup_point`       | transport sheet only                       | must be null for `daycare` rows — the `fee_account_service_columns` check constraint enforces this           |
| `slot`                             | daycare sheet only                         | must be null for `transport` rows, same constraint                                                           |

Do **not** compute or insert a "pending" column — there isn't one. Pending
is always derived by the `fee_account_balance` view from receivable minus
collected (`CLAUDE.md` rule 3); inserting a stored pending value would
violate that.

## 4. `payment`

One row per historical payment already collected, in whatever order the
office's payment log has them:

| Schema column    | Spreadsheet source                                | Notes                                                                                                                       |
| ---------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `fee_account_id` | the fee_account row from step 3                   |                                                                                                                             |
| `amount_paise`   | payment amount in rupees on the sheet             | same rupees→paise ×100 conversion as above                                                                                  |
| `paid_on`        | the real historical date the payment was received | not today's import date — this feeds ageing and monthly collection figures                                                  |
| `method`         | how it was collected                              | must be one of `cash` / `upi` / `cheque` / `bank_transfer`; ask the office for the closest match to anything else on record |
| `reference`      | cheque number / UPI ref, if recorded              | optional                                                                                                                    |
| `recorded_by`    | who originally collected it, if known             | otherwise something honest like `'office-import'`, not a fabricated name                                                    |

Every payment row inserted here is permanent history the moment it lands —
`payment` is append-only (`CLAUDE.md` rule 2). Double-check amounts and
dates before insert rather than after. If a row does turn out to be wrong
post-import, fix it the same way the app does for any other correction:
set `voided_at`/`void_reason` on the bad row (never `UPDATE`/`DELETE` it),
then insert a fresh, correct `payment` row alongside it.

## 5. Verify

After import, spot-check a handful of students against the source
spreadsheet using the app itself (not raw SQL) — the same
`fee_account_balance`/`fee_account_record` views every dashboard reads from:

```sql
select * from fee_account_record where student_admission_no = '<some admission no>';
```

Confirm `collected_paise`, `pending_paise`, and `last_paid_on` match what
the office expects for a few known students in each branch/service before
considering the import done.
