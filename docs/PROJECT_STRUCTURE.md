# OryCMS — Project Structure

This document describes how the repository is organized today, as verified by reading the source. It is kept up to date by whoever (human or agent) changes the structure — see the end-of-task routine in `AGENTS.md`.

## Overview

OryCMS is a self-hosted CMS that runs embedded inside a Next.js App Router application rather than as a separate service. This repository is two things at once: (1) a working Next.js reference app at the repo root (`app/`, `orycms/`, `orycms.config.ts`) that you can run with `npm run dev` today, and (2) a set of four npm packages under `packages/` (`@ory-cms/core`, `@ory-cms/next`, `@ory-cms/cli`, `create-ory-cms`) that are extracted/republished versions of the same functionality for consumers to install into their own apps. The reference app talks directly to PostgreSQL via `pg`; the schema, auth, RBAC, content, media, plugin, and email engines all live under `orycms/` and are imported by the Next.js routes in `app/`.

## Directory tree

```
orycms.config.ts          Root app's own collection/config definition (sample content model)
middleware.ts             Edge auth gate — decides which requests need a session before they reach a route
instrumentation.ts        Next.js startup hook — loads persisted collection schemas on boot
next.config.ts            Next.js config (currently empty/default)
components.json           shadcn/ui generator config (where generated UI primitives go)

app/                       Next.js App Router: pages + REST API
├── api/orycms/            REST API route handlers (auth, collections, content, media, roles, users, settings, plugins, ...)
├── admin/                 Real admin screens (collections list/create/edit, content list/edit) wired to live data
├── login/, setup/         Auth-flow pages (login, first-run setup)
├── collections/, content/ Top-level duplicate route trees — thinner/placeholder versions of app/admin/*
├── analytics/, customers/, orders/, products/, inventory/, marketing/, seo/, categories/, database/
│                          Placeholder dashboard screens (static UI, no live data wiring) — see status notes below
└── layout.tsx, page.tsx, not-found.tsx

orycms/                    The CMS engine source used by the root app (imported via the "@/*" path alias)
├── auth/                  Login, sessions, password hashing, invite/reset token links
├── rbac/                  Role-based permission engine
├── roles/, users/         Role and user persistence (repos)
├── schema/                Collection schema definition, validation, persistence
├── content/               Content CRUD engine, draft/publish state machine, filtering/sorting
├── mapper/                Schema-to-SQL mapping, migration planning, schema diffing
├── migrations/            Migration execution engine (idempotent, transactional)
├── database/              Database adapter interface + adapters/ (see "Where to change what")
├── media/                 Media upload/storage engine
├── plugins/               Plugin discovery, manifest validation, dependency resolution, registry
├── hooks/                 Lifecycle hook engine + registered hook points
├── email/                 Email provider factory + service (used by auth invite/reset flows)
├── admin/                 Admin page/sidebar registry (lets features register admin UI)
├── settings/, tokens/, audit/
│                          Settings persistence, one-time tokens, audit log
├── services/              A parallel service-facade layer — see note below, mostly unfinished
├── components/            React components for the admin dashboard (dashboard shell, collections, content, media, ui)
├── lib/                   Shared helpers: DB pool, route guards (auth+permission check wrapper), error mapping
└── types/                 Shared TypeScript types for every domain above

packages/
├── core/                  @ory-cms/core — publishable engine package (auth, schema, RBAC, hooks, DB adapters, services, server-side)
├── next/                  @ory-cms/next — publishable UI package (admin dashboard components, React hooks, Tailwind styles)
├── cli/                   @ory-cms/cli — publishable CLI (`init`, `plugin`, `config` commands)
└── create-orycms/         create-ory-cms — publishable scaffolder binary

docs/                      Project documentation (this file, ARCHITECTURE.md, NAMING_CONVENTIONS.md)
public/                    Static assets served by the root Next.js app
.github/                   Issue templates, funding config (community/contribution files)
```

Note on current honest status of the app/ screens: several top-level dashboard routes exist as pages but are not yet wired to real data (placeholder UI or static content). If you are picking a task, check `internal/PROGRESS.md` (not public) for the current, maintained list of what's real vs. not — this file only describes the physical layout, not feature completeness.

## How the packages relate

**Root `orycms/` and `packages/core/src/` (and `orycms/components/` and `packages/next/src/components/`) are two separately maintained source trees, not a build output or a symlink.** Verified by diffing them directly: some files are byte-identical (e.g. `content.engine.ts`), others have already diverged (e.g. `auth.ts`, `index.ts`, `hooks/index.ts`), and each side has files the other doesn't (e.g. `orycms/lib/error-capture.ts` has no counterpart in `packages/core/src/lib/`). There is no copy script, build step, or CI workflow anywhere in the repo that keeps them in sync — confirmed by searching `package.json` scripts and `tsup.config.ts` files in every package, and by the absence of a `.github/workflows/` directory.

**Practical consequence: a fix made in one tree does not automatically apply to the other.** If you change behavior in `orycms/content/content.engine.ts` (the file the root app actually runs), the same bug or feature gap still exists in `packages/core/src/content/content.engine.ts` (the file that ships to npm consumers) until someone manually ports the change — and vice versa. Any task that touches shared engine/auth/schema/content/media/plugin/hook logic should check both locations.

`packages/cli` and `packages/create-orycms` are not duplicated anywhere else in the repo — they only exist as their own package source.

## Request flow

A typical authenticated API request flows through four layers:

1. **`middleware.ts`** (repo root) — runs on every request except static assets. It allow-lists a small set of public pages and public auth API routes, allow-lists unauthenticated `GET` on the public content-list endpoints, and otherwise checks only that an `orycms_session` cookie is *present* (not that it's valid) before letting the request through. If absent, it redirects to `/login`.
2. **Route handler** (`app/api/orycms/**/route.ts`) — the actual REST endpoint. Reads the request, and for anything that isn't explicitly public, calls a guard before doing anything else.
3. **Guard** (`orycms/lib/route-guards.ts` → `guardOryCMS()`) — composes two checks: `protectOryCMSAdminRoute()` (validates the session against the database, from `orycms/auth`) and `requireOryCMSPermission()` (checks the session's role against the RBAC permission matrix, from `orycms/rbac`). Throws a typed `OryCMSAuthError` on failure, which the route catches via `toErrorResponse()` to produce a consistent JSON error envelope.
4. **Engine** (`orycms/content/content.engine.ts`, `orycms/media/media.engine.ts`, etc.) — the actual business logic. Engines run lifecycle hooks (`orycms/hooks`) before/after their operation, then talk to the database.
5. **Database** — engines currently issue SQL directly against a `pg.Pool` (`orycms/lib/db.ts`) rather than going through the `orycms/database/adapter.interface.ts` abstraction for every operation — the adapter layer exists and is registered, but core read/write paths in the content and media engines are Postgres-specific today.

Not every route follows step 2–3 identically: a small number of routes call the lower-level `protectOryCMSAdminRoute` + `requireOryCMSPermission` pair directly instead of the `guardOryCMS` wrapper. Functionally equivalent, but it's worth normalizing on one pattern — see `internal/PROGRESS.md`.

## Where to change what

| I want to... | Edit these files |
|---|---|
| Add or change a field type | `orycms/schema/collection.schema.ts` (type definition) → `orycms/mapper/field.mapper.ts` (DB mapping) → `orycms/content/content.validator.ts` (validation rules) → the matching admin input component under `orycms/components/collections/` or `orycms/components/content/` (e.g. `OryCMSDynamicField`) |
| Add a new REST API route | `app/api/orycms/<path>/route.ts`, following the guard → engine → `toErrorResponse` pattern in an existing route (e.g. `app/api/orycms/users/route.ts`) |
| Change permission rules for a role | `orycms/rbac/rbac.engine.ts` (the permission matrix) |
| Change session/login behavior | `orycms/auth/auth.ts` |
| Add a database adapter or fix an existing one | `orycms/database/adapters/<name>.adapter.ts`, implementing `orycms/database/adapter.interface.ts`; also register it in `orycms/database/registry.ts` |
| Change how migrations run | `orycms/migrations/migration.engine.ts` (execution) and `orycms/core/core.migration.ts` (initial schema install) |
| Add a lifecycle hook point | `orycms/hooks/hook.constants.ts` (name it) and call `runOryCMSBeforeHooks`/`runOryCMSAfterHooks` from the relevant engine |
| Change email sending | `orycms/email/providers.ts` (add a provider) or `orycms/email/email.factory.ts`/`email.service.ts` (sending logic) |
| Change an admin dashboard screen | The matching file under `app/admin/` (for the screens that are real) or `app/<name>/page.tsx` (for the top-level placeholder screens) |
| Change the CLI | `packages/cli/src/` — command registration is in `packages/cli/src/index.ts` |
| Change the scaffolder | `packages/create-orycms/src/` — entry point is `index.ts`, actual logic in `runner.ts` |
| Publish a fix to npm consumers, not just the reference app | Remember to also edit the matching file under `packages/core/src/` or `packages/next/src/` — see "How the packages relate" above |

## Available npm scripts

Root (`package.json`), run against the reference app:

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Next.js dev server (Turbopack) |
| `npm run dev:clean` | Removes `.next` then starts the dev server |
| `npm run build` | Production build (`next build`) |
| `npm run build:dev` | Same as `build` today (alias) |
| `npm run start` | Starts the production server from a prior build |
| `npm test` | Runs the Vitest suite (`vitest run`) |
| `npm run typecheck` | `tsc --noEmit` — no code emitted, just type errors |
| `npm run lint` | `eslint .` |
| `npm run format` | `prettier --write .` |

Each package under `packages/*` has its own `package.json` with equivalent scripts (`build` via `tsup`, `clean`, `typecheck`, `test`), plus a `prepublishOnly` script that chains clean → build → typecheck (and, for `cli`/`create-orycms`, `test`) before anything is published. `cli` and `create-orycms` also have a `lint` script (`eslint src/`).
