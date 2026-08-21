# Deployment runbook

One-time setup for shipping this app to production. Everything here is done
by hand in the Vercel and Supabase dashboards — nothing in this file is
automated, and nothing here should be run against the local dev stack.

## 1. Create the production Supabase project

1. In the Supabase dashboard, create a new project (a name like
   `eurokids-fee-tracker-prod` and the region closest to the branches is
   fine — there's no multi-region requirement).
2. Apply the schema: `supabase link --project-ref <ref>` then
   `supabase db push` from this repo, which applies every migration in
   `supabase/migrations/` in order. Do **not** run `supabase db reset`
   against a production project — `reset` drops and recreates the database
   from scratch.
3. Do **not** run `npm run db:seed` against production. That script exists
   only to generate fake students/payments for local dev and CI — real
   student data is PII and must never be seeded, faked, or otherwise
   fabricated in a way that mixes with production rows.
4. Create the one shared admin login by hand: Authentication → Users → Add
   user. The app treats this as a plain username, not a real email
   address — Supabase Auth itself has no username concept, so the sign-in
   form takes a username and derives a fixed internal address from it (see
   `src/lib/auth/username.ts`) before calling `signInWithPassword`. Use the
   same scheme here: for a chosen username like `frontoffice`, create the
   user with email `frontoffice@login.internal` and a strong password (not
   the `deetha` used by local tests). This mirrors how the local
   `auth:seed` script creates the dev admin, except done once, manually, in
   the dashboard — there is no script that touches the production auth
   store.
5. Authentication → URL Configuration:
   - **Site URL**: the production domain (e.g. `https://fees.eurokids-<branch>.example`).
   - **Redirect URLs**: add the production domain and, if Preview
     deployments should also be able to sign in, a wildcard for Vercel's
     preview URL pattern (`https://*-<your-vercel-team>.vercel.app`).
   - Nothing in the app currently calls `redirectTo`/`emailRedirectTo` (no
     magic-link or password-reset flow exists yet), so this doesn't gate any
     working feature today — but it's a five-minute step now versus a
     confusing failure the day someone adds one, and Supabase's dashboard
     already flags an unset Site URL as a warning.
6. Settings → API: copy the **Project URL**, **anon public** key, and
   **service_role** key — needed in step 3 below. Treat the service_role key
   as a password: it bypasses RLS entirely.

## 2. Create the Vercel project

1. Import this repository into a new Vercel project. Framework preset
   should auto-detect as Next.js; no build command overrides are needed
   (`next build --turbopack` from `package.json` is used as-is).
2. Leave the root directory as the repo root — this isn't a monorepo.

## 3. Environment variables

Set these in Vercel → Project Settings → Environment Variables. Vercel lets
each variable be scoped to Production, Preview, and/or Development
independently — use that scoping rather than setting one value for all
three, since Preview deployments should not share write access to the
production database.

| Variable                        | Production                       | Preview                                           | Notes                                                                                                                                                                                                                                                                |
| ------------------------------- | -------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Production project's Project URL | Same as Production, or a separate staging project | Public — safe to expose, it's just a hostname.                                                                                                                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production project's anon key    | Matches whichever project `_URL` above points to  | Public — this is what RLS exists to protect against, not a secret in itself.                                                                                                                                                                                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Do not set**                   | **Do not set**                                    | The deployed app never reads this (see `src/lib/env.ts` — only the two `NEXT_PUBLIC_*` vars are validated). It exists solely for local/CI admin-user seeding; putting it in Vercel would be a live bypass-RLS credential sitting in a platform you don't need it in. |

`Development` (Vercel's designation for `vercel dev` / local pulls via
`vercel env pull`) should just mirror your own `.env.local` — most people
never touch this scope and use `.env.local` directly instead, which is fine.

If you'd rather Preview deployments not touch the production database at
all (recommended once there's real student data in it), create a second,
separate Supabase project for Preview and point its `NEXT_PUBLIC_*` vars at
that instead — same steps as section 1, minus the real admin user (a
throwaway login + seed data is fine there, since it's not production).

## 4. Verify

- Trigger a deploy (push to `main`, or the initial import).
- Visit the deployed URL, confirm the login page loads and the shared admin
  account can sign in.
- Confirm signing in redirects to `/transport` and the shell (sidebar,
  year/branch selectors) renders.
- Confirm CI (`.github/workflows/ci.yml`) is green on the commit being
  deployed — Vercel deploying a red commit is not itself blocked by
  anything in this repo, so treat "CI green" as a manual gate for now.

## 5. Ongoing

- Schema changes ship as new files in `supabase/migrations/`, applied to
  production with `supabase db push` after merging to `main` — there is no
  automatic migration-on-deploy step, so this is a manual action per release
  that changes the schema.
- See [`importing-existing-records.md`](./importing-existing-records.md) for
  bringing the office's existing real records into this schema.
