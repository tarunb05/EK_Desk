# CLAUDE.md — EK Desk

This file contains the non-negotiable constraints for this project. These rules survive context compaction — re-read this file if unsure.

## Domain model

Five tables. Postgres, snake_case, UUID primary keys, `created_at`/`updated_at` on mutable tables.

```
branch          id, code, name, is_active
academic_year   id, label, starts_on, ends_on, is_current
student         id, branch_id, admission_no, full_name, guardian_name,
                phone, class_section, status, notes
fee_account     id, student_id, academic_year_id,
                service_type ('transport'|'daycare'),
                total_receivable_paise bigint, due_date,
                starts_on, ends_on, status ('active'|'discontinued'),
                route_name, pickup_point,   -- transport only, null otherwise
                slot                        -- daycare only, null otherwise
payment         id, fee_account_id, amount_paise bigint, paid_on,
                method ('cash'|'upi'|'cheque'|'bank_transfer'),
                reference, note, recorded_by,
                voided_at, void_reason
expense_category  id, name, is_active, sort_order
expense           id, branch_id, academic_year_id, category_id,
                  amount_paise bigint, spent_on, method, reference, note,
                  created_by, updated_by, created_at, updated_at
```

Non-negotiable rules on this model:

1. **Money is stored as integer paise (`bigint`). Never a float, never `numeric` in TypeScript.** Convert to rupees only in a single formatting helper at the display edge, using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
2. **`payment` is append-only.** No `UPDATE`, no `DELETE`. Corrections set `voided_at` and `void_reason`; voided rows are excluded from every aggregate but still visible in the student's history.
3. **`pending` is never stored.** Create a `fee_account_balance` view that derives `collected_paise` as `sum(amount_paise) filter (where voided_at is null)`, `pending_paise` as `total_receivable_paise - collected_paise`, and `last_paid_on`. All reads go through the view.
4. **Overdue is computed at read time**: `pending_paise > 0 AND due_date < current_date`.
5. **One `fee_account` table serves both services.** The transport and daycare dashboards must be the same query with a different `service_type` filter — the money and aggregation logic exists exactly once. Add `CHECK` constraints so a `daycare` row cannot carry `route_name`/`pickup_point` and a `transport` row cannot carry `slot`.
6. **RLS is default-deny, and there are now two roles: `admin` and `teacher`** (phase 8 — `profile` table, one row per auth user). The anon key still gets nothing. An admin has full access, matching everything this app did before phase 8. A teacher gets read-only access to `student`, `fee_account`, and `payment`, all scoped to their own `branch_id` — individual figures (pending, receivable, payment history) on the **Students page** are fine for a teacher to see; the **dashboards** (`/transport`, `/daycare`) are the thing kept admin-only, by route (`ROUTE_ACCESS`), not by hiding the underlying data. A teacher writes nothing directly to `student`/`fee_account`/`payment` — adding a student, editing one, or recording a payment all go through `student_submission` / `student_edit_submission` / `payment_submission` (typed columns, pending/approved/rejected, same convention as every other table here) and only take effect once an admin approves them via the matching `approve_*` `security definer` function. Role and branch are read via the `auth_role()` / `auth_branch_id()` / `auth_is_admin()` `security definer` functions (which read `profile`), never by trusting a client-supplied role, branch, or user id. `lib/auth/routes.ts`'s `ROUTE_ACCESS` map is the single source both middleware and the sidebar nav read for which role may reach which route — never duplicate that list.
7. Index `fee_account(academic_year_id, service_type, status)`, `fee_account(student_id)`, `payment(fee_account_id)`, `payment(paid_on)`, `student(branch_id)`, plus a trigram index on `student.full_name`.
8. **`expense` is the one exception to append-only money (rule 2).** It's spend the office made, not receivable owed to it — nothing downstream depends on an expense row never changing the way collection/pending figures depend on `payment` never changing. Edited and hard-deleted directly, with `created_by`/`updated_by` stamps and a server-side edit/delete log (actor, expense id, category id, amount, timestamp — no free text) as the only audit trail. No soft-delete flag, no shadow history table.
9. **Unlike the fee dashboards, the Expenses dashboard is reachable by both roles.** Rule 6 already lets a teacher read their own branch's individual `payment`/`fee_account` figures — what's admin-only there is the *dashboard aggregate* (`/transport`, `/daycare`, gated by route, not by hiding row-level data). `expense` breaks that pattern deliberately: a teacher gets an aggregate `/expenses` dashboard too, scoped to their own branch. The fee side is untouched — `/transport` and `/daycare` stay admin-only exactly as before.
10. **A teacher's expense needs no approval queue**, unlike a student submission. The Phase 8 queue exists because a student/fee-account write creates receivable a parent will be billed against; an expense creates no receivable and settles no account, so gating it behind approval would be ceremony, not safety.
11. **Never fold an expense total into `fee_account_record`/a dashboard RPC.** Build a separate expense-only aggregate instead — the two money directions must never share a query function, so a change to one can never silently move a figure on the other.

## URL as state

Every filter and sort lives in the query string: `?year=2026-27&branch=all&service=transport&status=overdue&class=Nursery&sort=pending&dir=desc&q=sharma&page=2`. Parse and validate the params with Zod in the Server Component, and push filtering, sorting and pagination into Postgres — never fetch all rows and filter in React. The back button must work and a filtered view must be shareable as a link.

## Design system

This is a back-office tool for a real business. It must look like a working instrument — dense, quiet, information-first, closer to a bank statement than a SaaS landing page. Light theme only.

Tokens (all text colours contrast-checked against white at 4.5:1 or better):

```
--ink:              #1C1B19   /* primary text          17.2:1 */
--ink-secondary:    #57544E   /* secondary text         7.5:1 */
--ink-muted:        #6B675F   /* labels, captions       5.6:1 */
--canvas:           #F3EEE3   /* app background — beige */
--surface:          #FFFFFF   /* cards, table body */
--surface-accent:   #E8EEF7   /* selected/hovered row, callout */
--hairline:         #E3E2E1   /* table rules, dividers */
--border:           #C1C0C2   /* input borders, card edges */
--accent:           #2A3A5C   /* links, active tab, primary button 11.3:1 — dull dark navy */
--accent-fill:      #5B729A   /* chart series, non-text fills */
--positive:         #57523F   /* "collected" figures                7.8:1 */
--positive-fill:    #837D68   /* chart series */
--attention:        #8C3F42   /* overdue figures, errors            7.2:1 */
--attention-fill:   #ECC5C6   /* overdue row tint, chart series */
```

Chart series order: `--accent-fill` → `--positive-fill` → `--attention-fill` → `--border`. Never encode meaning by colour alone; overdue rows also get a left rule and a text label.

Typography: Inter via `next/font` for everything — body text, labels, every numeral (tabular-nums support, legible at small sizes), and every page title (`<h1>`). One typeface app-wide, including the "EK Desk" wordmark in the sidebar/top bar (13px, `font-medium`) — there's no second typeface layered on for titles. Each `<h1>` keeps its own (usually `font-medium`) weight, **except the login page's own `<h1>` wordmark**, a scoped Phase 11 exception: bold weight at `--text-login-wordmark` (36px, `tracking-[-0.02em]`), still `--ink` — the login page has no data on it and can carry the brand at a size and weight the dashboards can't afford. Scale 11/12/13/14/16/20/28px, same exception as above for the login wordmark's 36px. Body 13–14px, not 16px. `font-variant-numeric: tabular-nums` on every element containing a number. Section labels 11px uppercase with `letter-spacing: 0.06em` in `--ink-muted`.

**Banned:** gradients, `backdrop-filter`/glassmorphism, purple or indigo, emoji, shadows larger than `0 1px 2px rgba(0,0,0,.05)`, border-radius above 6px — **except `--radius-field` (10px), used only by the login page's inputs and its submit button, matched to each other so neither reads as unfinished against the other; nowhere else** —, hero sections, decorative illustrations, animated counters, a second accent colour, centre-aligned body text, icon-only buttons without a label or `aria-label`.

**Required:** 8px spacing grid (4px permitted inside dense components), 36–40px table rows, right-aligned tabular numerals for money and counts, hairline rules in preference to card shadows, Indian digit grouping (₹1,24,500), transitions of 120–150ms and only on state change, and empty states written as a full sentence that says what to do next.

Layout: fixed left sidebar (Transport / Daycare / Students / Settings), a top bar holding the academic-year and branch selectors since both apply to every screen, content column capped at 1440px. Keyboard-accessible throughout; visible focus rings; the record table must be usable with the keyboard alone.

## Project rules

- Conventional Commits. One logical change per commit. `main` always deployable; work on branches, merge by squashed PR.
- No `any`, no non-null assertions, no `eslint-disable` without a comment explaining why.
- Server Components by default; `'use client'` only where interactivity genuinely requires it, and as far down the tree as possible.
- Errors surface to the user as a readable sentence, never a swallowed `catch` and never a raw Postgres error string.
- Loading and empty states are part of the definition of done for every screen, not a follow-up.
- Real student data is PII: it never enters git, never enters a screenshot, never enters a log line.
- When you hit a decision with a real tradeoff — a library, an index, a denormalisation, a caching choice — stop, state the options in one line each with the cost of each, and ask me. I need to be able to defend every choice in this codebase in an interview.
- Do not tell me a phase is done while any test is failing or skipped.
- Server Actions, not API routes, for everything — Route Handlers exist for exactly two genuine exceptions: something that needs a webhook, or a binary file download that needs a `Content-Disposition` header (a Server Action can't stream one). Nothing else.
