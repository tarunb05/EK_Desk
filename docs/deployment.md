# Deployment runbook

One-time setup for shipping this app to production. Everything here is done
by hand in the Vercel and Supabase dashboards (plus a few CLI commands run
from your own terminal) — nothing here is automated, and nothing here should
be run against the local dev stack.

Every step below reflects something that actually tripped us up doing this
for real, not just the happy path — read the callouts, they're there because
the obvious thing is wrong.

## 1. Create the production Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard), sign in,
   click **New Project**.
2. Name it something like `eurokids-fee-tracker-prod`, pick the region
   closest to the branches, let it generate a database password (save it —
   you likely won't need it for anything below, but keep it somewhere safe
   regardless).
3. Wait for provisioning (1-2 minutes).

## 2. Push the schema

From your own terminal (this needs an interactive browser login, so it can't
be run through an AI agent's shell):

```bash
cd "path/to/this/repo"
npx supabase login          # opens your browser — click Authorize
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`YOUR_PROJECT_REF` is the short id in the project's dashboard URL:
`supabase.com/dashboard/project/<this-part>`.

> **If `link` fails with `AlreadyExists: FileSystem.makeDirectory
> (...\supabase\.temp)`**: delete the local `supabase/.temp` folder (it's
> gitignored, disposable CLI cache) and re-run `link`.

`db push` applies every file in `supabase/migrations/` in order — tables,
indexes, views, RLS policies, everything. It does **not** insert any data
(see step 5 — this bites people).

Do **not** run `supabase db reset` or `npm run db:seed` against this
project: `reset` drops and recreates the database from scratch, and
`db:seed` inserts fake students/payments meant only for local dev and CI —
real student data is PII and must never be mixed with fabricated rows.

## 3. Get the Project URL and anon key

Settings → **API Keys**.

> **Use the "Legacy anon, service_role API keys" tab**, not the default
> "Publishable and secret API keys" tab. This app's code (`@supabase/ssr`)
> was built against the classic anon-JWT key; the newer
> `sb_publishable_...` format is a different Supabase feature and hasn't
> been verified against this codebase.

On that tab:
- **anon / public** key → a long string starting with `eyJ...`. This is
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **service_role** key → treat as a password, bypasses RLS entirely. Needed
  for `SUPABASE_SERVICE_ROLE_KEY` in step 5 (the Settings → Teachers feature
  needs it) — copy it now while you're on this screen.

The **Project URL** is shown separately (top of the API settings, or under
Settings → General/Data API) — it looks like `https://xxxxxxxx.supabase.co`.

> **Copy exactly that, nothing appended.** The Data API page also shows a
> REST endpoint like `https://xxxxxxxx.supabase.co/rest/v1` — that's a
> different value. Pasting the `/rest/v1` version into
> `NEXT_PUBLIC_SUPABASE_URL` makes every Supabase client request double up
> the path (`/rest/v1/auth/v1/token`, 404) and nothing works. The value you
> want has **only** the `.supabase.co` domain, no path after it.

## 4. Create the Vercel project

1. [vercel.com/new](https://vercel.com/new) → import this repo. Framework
   auto-detects as Next.js, no build command overrides needed.
2. Leave the root directory as the repo root.

## 5. Environment variables

Project Settings → Environment Variables, scoped to **Production and
Preview**:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the plain Project URL from step 3 | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the legacy anon key from step 3 | Public — RLS is the real protection, not secrecy of this key |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key from step 3 | **This reverses earlier guidance.** As of the teacher-accounts feature (Settings → Teachers), the running app uses this key at runtime for the first time — creating a teacher login is only possible through the Supabase Admin API, which needs it (`src/lib/supabase/admin.ts`). Treat it exactly like a password: it bypasses RLS entirely. Every server-side use of it is gated behind `requireRole("admin")` first. |

> **Editing an env var does not redeploy the app.** `NEXT_PUBLIC_*` values
> are baked into the build at build time, so the already-built deployment
> keeps using whatever was set when it was last built. After changing any
> env var: Deployments tab → "⋮" on the latest deployment → **Redeploy**,
> and wait for it to say **Ready** before testing.

## 6. Create the shared admin login

Supabase dashboard → Authentication → **Users** → **Add user**.

> **This is not a real email address.** The app has no username concept in
> Supabase Auth itself — the login form takes a plain username and derives
> a fixed, non-routable internal address before calling
> `signInWithPassword` (see `src/lib/auth/username.ts`). For a username like
> `frontoffice`, create the Supabase user with email
> **`frontoffice@login.internal`** and a strong password (not `deetha` —
> that's the plaintext local/CI test password, committed in this repo's own
> `scripts/test-credentials.ts`, and reusing it for the real login is a real
> weak-credential risk, not just a style nit).

Check "Auto Confirm User" if the dashboard offers it.

This manual dashboard step is only needed **once**, for the first admin.
After that, sign in and use **Settings → My login** to change this
initial password to something only you know, and **Settings → Teachers**
to create every teacher login from then on — no more direct Supabase
dashboard user creation needed for teachers.

## 7. Auth URL configuration

Still in Authentication → **URL Configuration**:
- **Site URL**: your Vercel deployment URL (`https://your-app.vercel.app`,
  or a custom domain once you have one).
- **Redirect URLs**: add that same URL.

Nothing in the app currently calls `redirectTo`/`emailRedirectTo`, so this
doesn't gate a working feature today — but Supabase's dashboard flags an
unset Site URL as a warning, and it's a five-minute step now versus a
confusing failure the day someone adds a magic-link/reset flow.

## 8. Seed the first academic year and branch

`db push` creates the `academic_year` and `branch` **tables** — it inserts
no rows. Every dashboard page resolves "which year am I looking at" through
`resolveYearAndBranch`, which **throws** if there are zero academic years —
so the very first login will crash on redirect to `/transport` with a
generic error page. This is expected on a brand-new project, not a bug.

Fix it through the app itself, no SQL needed:
1. Log in with the admin user from step 6. It'll likely crash after
   redirecting — that's fine.
2. Manually type `/settings` into the URL bar (your login session is still
   valid; only the page you landed on crashed).
3. Add your real academic year (correct label and date range, check "Make
   this the current year") and your real branches.
4. Go to `/transport` — it should now load cleanly.

## 9. Verify

- Confirm CI (`.github/workflows/ci.yml`) is green on the commit being
  deployed — Vercel deploying a red commit isn't itself blocked by anything
  in this repo, so treat "CI green" as a manual gate for now.
- Sign in on the deployed URL, confirm redirect to `/transport`, confirm the
  shell (sidebar, year/branch selectors) renders with the real year/branch
  you just added.
- Try adding a student, confirm it shows up.

## 10. Ongoing

- Schema changes ship as new files in `supabase/migrations/`, applied with
  `supabase db push` after merging to `main` — no automatic
  migration-on-deploy step, so this is a manual action per release that
  changes the schema.
- If you want Preview deployments not touching the production database at
  all (recommended once there's real student data in it), create a second,
  separate Supabase project for Preview and point its `NEXT_PUBLIC_*` vars
  at that instead — same steps as above, minus the real admin user (a
  throwaway login + a manually-added test year/branch is fine there, since
  it's not production).
- See [`importing-existing-records.md`](./importing-existing-records.md) for
  bringing the office's existing real records into this schema.
