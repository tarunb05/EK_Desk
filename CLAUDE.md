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
6. **RLS is default-deny, and there are now two roles: `admin` and `teacher`** (phase 8 — `profile` table, one row per auth user). The anon key still gets nothing. An admin has full access, matching everything this app did before phase 8. A teacher reads and writes `student`, `fee_account`, and `payment` scoped to their own `branch_id` — individual figures (pending, receivable, payment history) on the **Students page** are fine for a teacher to see; the **dashboards** (`/transport`, `/daycare`) are the thing kept admin-only, by route (`ROUTE_ACCESS`), not by hiding the underlying data. **Since 2026-11-12 a teacher adds students, edits them, records payments and voids payments directly, with no admin approval** (`20261112000000_teacher_direct_writes`): RLS insert/update policies scoped to their branch, a trigger that still stops a teacher changing a student's `branch_id` or `admission_no`, and `activity_log` (rule 12) as the audit trail. **Deleting a student, or one of their enrollments, are the teacher actions that still need approval** — they go through `student_delete_submission` / `enrollment_delete_submission` and only take effect once an admin approves via `approve_student_delete` / `approve_enrollment_delete` (an admin deletes directly with `hard_delete_student` / `hard_delete_fee_account`; a confirmed payment claim blocks both). **Academic years roll over by themselves**: a daily `pg_cron` job runs `roll_academic_year()`, which adds the year containing today (1 April–31 March, labelled `2027-28`) and makes it current once the previous current year has ended. The older `student_submission` / `student_edit_submission` / `payment_submission` tables and their `approve_*` functions remain only so an admin can finish requests queued before that date; no code writes new rows to them. Role and branch are read via the `auth_role()` / `auth_branch_id()` / `auth_is_admin()` `security definer` functions (which read `profile`), never by trusting a client-supplied role, branch, or user id. `lib/auth/routes.ts`'s `ROUTE_ACCESS` map is the single source both middleware and the sidebar nav read for which role may reach which route — never duplicate that list.
7. Index `fee_account(academic_year_id, service_type, status)`, `fee_account(student_id)`, `payment(fee_account_id)`, `payment(paid_on)`, `student(branch_id)`, plus a trigram index on `student.full_name`.
8. **`expense` is the one exception to append-only money (rule 2).** It's spend the office made, not receivable owed to it — nothing downstream depends on an expense row never changing the way collection/pending figures depend on `payment` never changing. Edited and hard-deleted directly, with `created_by`/`updated_by` stamps and a server-side edit/delete log (actor, expense id, category id, amount, timestamp — no free text) as the only audit trail. No soft-delete flag, no shadow history table.
9. **Unlike the fee dashboards, the Expenses dashboard is reachable by both roles.** Rule 6 already lets a teacher read their own branch's individual `payment`/`fee_account` figures — what's admin-only there is the *dashboard aggregate* (`/transport`, `/daycare`, gated by route, not by hiding row-level data). `expense` breaks that pattern deliberately: a teacher gets an aggregate `/expenses` dashboard too, scoped to their own branch. The fee side is untouched — `/transport` and `/daycare` stay admin-only exactly as before.
10. **A teacher's expense needs no approval queue.** Since 2026-11-12 neither do a teacher's student, fee-account or payment writes (rule 6) — only a student delete is still queued.
11. **Never fold an expense total into `fee_account_record`/a dashboard RPC.** Build a separate expense-only aggregate instead — the two money directions must never share a query function, so a change to one can never silently move a figure on the other.
12. **`activity_log` is the one table `student`/`fee_account`/`payment`/`expense`/`expense_category`/`student_submission`/`profile`/`payment_request`/`payment_claim` write to without a single line of application code asking them to.** One `security definer` trigger function (`log_activity()`), attached `after insert or update or delete` to all nine, writes one row per row changed — nobody can forget to log a mutation and nobody can bypass it, including a cascade delete. This matters especially for the last two: every write to `payment_request`/`payment_claim` already goes through a `security definer` function (`create_payment_request`, `confirm_payment_claim`, `submit_payment_claim`, etc., Phase 15) rather than a plain Node insert, so a trigger is the only mechanism that sees all of them regardless of which one wrote the row. Nobody, including an admin, has `insert`/`update`/`delete` on it; the trigger's `security definer` context is the only thing that can ever write a row. `actor_label` and `entity_label` are snapshots taken at write time, not a join evaluated at read time — a deleted student's name still has to render in a row describing their own deletion, and a join to a row that's gone returns nothing. **This is the one deliberate exception to the PII rule below**: `entity_label` holds a student's name (and, on `fee_account`/`payment`/`payment_request`/`payment_claim` rows, another student's name reached via the same snapshot) by design, in a table gated by RLS to `admin` only — never a line shipped to a third-party log drain, never phone numbers, UTRs, account numbers, or any other free-text field, and the exception is scoped to that one column.

## URL as state

Every filter and sort lives in the query string: `?year=2026-27&branch=all&service=transport&status=overdue&class=Nursery&sort=pending&dir=desc&q=sharma&page=2`. Parse and validate the params with Zod in the Server Component, and push filtering, sorting and pagination into Postgres — never fetch all rows and filter in React. The back button must work and a filtered view must be shareable as a link.

## Design system

Redesigned 2026-11-14 around one palette ([colorhunt 555879 / 98A1BC / DED3C4 / F4EBD3](https://colorhunt.co/palette/55587998a1bcded3c4f4ebd3)) and one visual reference (loopsii.com): flat colour blocks, pill controls, soft large radii, tight display type, hairline rules with square end-markers. It is still a back-office tool for a real business — the reference sets the *surface* (shape, colour, type), not the density. Record tables stay dense and information-first; the two screens with no data on them (the landing page `/` and `/login`) are where the reference is followed most literally. Light theme only.

Tokens (contrast measured, not assumed — every text/fill pairing listed is 4.5:1 or better):

```
--ink:              #1F2030   /* primary text          15.8:1 on surface, 13.5:1 on canvas */
--ink-secondary:    #4A4C63   /* secondary text         8.3:1 on surface,  7.1:1 on canvas */
--ink-muted:        #65677D   /* labels, captions       5.5:1 on surface,  4.7:1 on canvas */
--canvas:           #F4EBD3   /* app background, sidebar, top bar — palette cream */
--surface:          #FFFDF8   /* inputs, menus, dialogs, table body, plain tiles */
--surface-accent:   #E8EAF2   /* hovered row, callout */
--sand:             #DED3C4   /* colour block, nav hover, chips — palette sand */
--hairline:         #DED3C4   /* table rules, dividers */
--border:           #C3B6A2   /* input and outlined-button borders */
--accent:           #555879   /* links, active nav, primary button, dark block — palette slate; 6.8:1 on surface */
--accent-fill:      #98A1BC   /* colour block, chart series — palette periwinkle; takes --ink (6.2:1), never --positive */
--positive:         #57523F   /* "collected" figures on surface/canvas   7.7:1 */
--positive-fill:    #837D68   /* chart series */
--attention:        #8C3F42   /* overdue figures, errors                 7.1:1 */
--attention-fill:   #ECC5C6   /* overdue row tint, overdue block (takes --attention, 4.6:1) */
```

Text on a colour block: `--ink` on sand and periwinkle, `--canvas` on slate, `--attention` on attention-fill. Never `--ink-muted` on a block other than surface/canvas. Charts live in `components/charts` and always sit in a `ChartCard`. Fee colours are fixed by meaning, never by position: collected = `--accent`, pending (not yet due) = `--accent-fill`, overdue = `--attention` (ageing steps it 45% → 70% → 100% with age). A single-series chart (monthly columns, category bars) is `--accent` throughout, with filtered-out months in `--sand`. Thin marks (bars 10px, columns ≤24px with a 4px rounded top), hairline gridlines, compact rupee ticks (`formatPaiseCompact`), a legend for two or more series, one direct label on the peak rather than a number on every mark, and a visually-hidden table or `aria-label` carrying every value. The palette is muted by choice, so adjacent series are separated by lightness and a 2px gap, and every mark has its name and figure beside it. Never encode meaning by colour alone; overdue rows also get a left rule and a text label, and every stat tile carries its label and its own icon.

Typography: Hanken Grotesk via `next/font` for everything — body, labels, numerals, titles, the wordmark. One typeface app-wide. Scale 11/12/13/14/16/20/28px inside the app, plus 36/48/64/88px display sizes used only by the landing page, the login page and (28px) stat-tile figures. Body 13–14px, not 16px. Page titles (`<h1>`) are 28px `font-semibold`; `h1`/`h2` get `letter-spacing: -0.02em` globally. `font-variant-numeric: tabular-nums` on every element containing a number. Section labels 11px uppercase with `letter-spacing: 0.06em`. The "EK Desk" wordmark and its mark come from `components/shell/brand.tsx` — never hand-set it.

Shape: radius scale `sm` 6px (chips, badges) / `md` 10px (inputs, menus, table frames) / `lg` 16px (cards, stat tiles) / `xl` 28px (landing and login colour blocks). Every button is a pill (`rounded-full`); the active sidebar link is a slate pill. Depth comes from flat colour blocks and hairlines, not shadows.

**Copy:** no em dashes anywhere in user-visible text (use two sentences, a comma, a colon or a middle dot); an empty table cell is "-". Buttons say "Log in" / "Log out". Tab titles are sentence case and end " · EK Desk".

**Banned:** gradients, `backdrop-filter`/glassmorphism, any hue outside the palette family above (no second accent, no purple beyond the palette's own slate), emoji, shadows larger than `0 1px 2px rgba(0,0,0,.05)`, hero sections and decorative shapes anywhere except the landing page and the login panel (the tile mosaic in `components/ui/mosaic.tsx` is the one decorative element, drawn from the tokens), animated counters, centre-aligned body text, icon-only buttons without a label or `aria-label`.

**Required:** 8px spacing grid (4px permitted inside dense components), 36–40px table rows, right-aligned tabular numerals for money and counts, hairline rules in preference to card shadows, Indian digit grouping (₹1,24,500), motion as defined in the Motion block at the end of `globals.css` and nowhere else (a short fade-up when a page mounts, `.scroll-reveal` as a block enters the viewport, a 1 to 2px lift on hover for pills and `.hover-card`s, 120 to 250ms, all of it off under `prefers-reduced-motion`), and empty states written as a full sentence that says what to do next.

Layout: fixed left sidebar on the canvas (collapsible to an icon rail), a slim top bar for the signed-in user and sign-out, each page's own year/branch selectors beside its title, content column capped at 1440px. Keyboard-accessible throughout; visible focus rings; the record table must be usable with the keyboard alone.

## Project rules

- Conventional Commits. One logical change per commit. `main` always deployable; work on branches, merge by squashed PR.
- No `any`, no non-null assertions, no `eslint-disable` without a comment explaining why.
- Server Components by default; `'use client'` only where interactivity genuinely requires it, and as far down the tree as possible.
- Errors surface to the user as a readable sentence, never a swallowed `catch` and never a raw Postgres error string.
- Loading and empty states are part of the definition of done for every screen, not a follow-up.
- Real student data is PII: it never enters git, never enters a screenshot, never enters a log line — **except `activity_log.entity_label`, a scoped, deliberate exception; see domain model rule 12.**
- When you hit a decision with a real tradeoff — a library, an index, a denormalisation, a caching choice — stop, state the options in one line each with the cost of each, and ask me. I need to be able to defend every choice in this codebase in an interview.
- Do not tell me a phase is done while any test is failing or skipped.
- Server Actions, not API routes, for everything — Route Handlers exist for exactly two genuine exceptions: something that needs a webhook, or a binary file download that needs a `Content-Disposition` header (a Server Action can't stream one). Nothing else.
