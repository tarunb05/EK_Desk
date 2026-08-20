# CLAUDE.md — EuroKids Fee Management

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
```

Non-negotiable rules on this model:

1. **Money is stored as integer paise (`bigint`). Never a float, never `numeric` in TypeScript.** Convert to rupees only in a single formatting helper at the display edge, using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
2. **`payment` is append-only.** No `UPDATE`, no `DELETE`. Corrections set `voided_at` and `void_reason`; voided rows are excluded from every aggregate but still visible in the student's history.
3. **`pending` is never stored.** Create a `fee_account_balance` view that derives `collected_paise` as `sum(amount_paise) filter (where voided_at is null)`, `pending_paise` as `total_receivable_paise - collected_paise`, and `last_paid_on`. All reads go through the view.
4. **Overdue is computed at read time**: `pending_paise > 0 AND due_date < current_date`.
5. **One `fee_account` table serves both services.** The transport and daycare dashboards must be the same query with a different `service_type` filter — the money and aggregation logic exists exactly once. Add `CHECK` constraints so a `daycare` row cannot carry `route_name`/`pickup_point` and a `transport` row cannot carry `slot`.
6. **RLS is default-deny.** The anon key gets nothing. Authenticated users get full access for now, but write the policies so adding per-branch roles later is a policy change and not a schema change. Never trust a client-supplied `branch_id`.
7. Index `fee_account(academic_year_id, service_type, status)`, `fee_account(student_id)`, `payment(fee_account_id)`, `payment(paid_on)`, `student(branch_id)`, plus a trigram index on `student.full_name`.

## URL as state

Every filter and sort lives in the query string: `?year=2026-27&branch=all&service=transport&status=overdue&class=Nursery-A&sort=pending&dir=desc&q=sharma&page=2`. Parse and validate the params with Zod in the Server Component, and push filtering, sorting and pagination into Postgres — never fetch all rows and filter in React. The back button must work and a filtered view must be shareable as a link.

## Design system

This is a back-office tool for a real business. It must look like a working instrument — dense, quiet, information-first, closer to a bank statement than a SaaS landing page. Light theme only.

Tokens (all text colours contrast-checked against white at 4.5:1 or better):

```
--ink:              #1C1B19   /* primary text          17.2:1 */
--ink-secondary:    #57544E   /* secondary text         7.5:1 */
--ink-muted:        #6B675F   /* labels, captions       5.6:1 */
--canvas:           #FAF9F8   /* app background */
--surface:          #FFFFFF   /* cards, table body */
--surface-accent:   #F5E9E7   /* selected/hovered row, callout */
--hairline:         #E3E2E1   /* table rules, dividers */
--border:           #C1C0C2   /* input borders, card edges */
--accent:           #4A5E70   /* links, active tab, primary button  6.7:1 */
--accent-fill:      #8A9DB1   /* chart series, non-text fills */
--positive:         #57523F   /* "collected" figures                7.8:1 */
--positive-fill:    #837D68   /* chart series */
--attention:        #8C3F42   /* overdue figures, errors            7.2:1 */
--attention-fill:   #ECC5C6   /* overdue row tint, chart series */
```

Chart series order: `--accent-fill` → `--positive-fill` → `--attention-fill` → `--border`. Never encode meaning by colour alone; overdue rows also get a left rule and a text label.

Typography: Inter via `next/font`, scale 11/12/13/14/16/20/28px. Body 13–14px, not 16px. `font-variant-numeric: tabular-nums` on every element containing a number. Section labels 11px uppercase with `letter-spacing: 0.06em` in `--ink-muted`.

**Banned:** gradients, `backdrop-filter`/glassmorphism, purple or indigo, emoji, shadows larger than `0 1px 2px rgba(0,0,0,.05)`, border-radius above 6px, hero sections, decorative illustrations, animated counters, a second accent colour, centre-aligned body text, icon-only buttons without a label or `aria-label`.

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
