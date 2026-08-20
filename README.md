# EuroKids Fee Tracker

Internal fee-management app for a EuroKids preschool group with two branches, covering school transport and daycare fee accounts.

## Stack

Next.js 15 (App Router, TypeScript strict) · Supabase Postgres + Auth · Tailwind CSS v4 · Zod · Vitest · Playwright · Vercel.

See [`CLAUDE.md`](./CLAUDE.md) for the domain model, design system, and project rules governing this codebase.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase project credentials.
3. `npm run dev` — starts the app at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | Purpose                           |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the dev server              |
| `npm run build`     | Production build                  |
| `npm run lint`      | ESLint                            |
| `npm run typecheck` | TypeScript, no emit               |
| `npm run test`      | Unit + integration tests (Vitest) |
| `npm run test:e2e`  | End-to-end tests (Playwright)     |
| `npm run format`    | Format with Prettier              |

## Architecture

_To be filled in as phases land — see the Phases section of `CLAUDE.md`._

## Schema

_Schema diagram added in Phase 2 (Database)._

## Screenshots

_Added in Phase 7 (Ship), taken against seed data only — never real student data._
