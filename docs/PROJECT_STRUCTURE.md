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
├── admin/                 The entire dashboard — every screen lives under here now (collections, content, users,
│                          roles, media, settings, analytics, customers, orders, products, inventory, marketing,
│                          seo, categories, database, plugins). collections/* and content/* are wired to live data;
│                          most of the rest are still placeholder UI or mocked data — see `internal/PROGRESS.md`
│                          (not public) for the current real-vs-placeholder status of each screen.
├── login/, setup/         Auth-flow pages (login, first-run setup) — intentionally outside /admin, since they're
│                          the only pages an unauthenticated visitor can reach
└── layout.tsx, page.tsx, not-found.tsx    page.tsx redirects "/" straight to "/admin"

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

Note on current honest status of the app/admin/ screens: several of them exist as pages but are not yet wired to real data (placeholder UI or static content). If you are picking a task, check `internal/PROGRESS.md` (not public) for the current, maintained list of what's real vs. not — this file only describes the physical layout, not feature completeness.

## How the packages relate

**Root `orycms/`+`app/` and `packages/core/src/`+`packages/next/src/` are two separately maintained source trees, not a build output or a symlink.** There is no copy script, build step, or CI workflow anywhere in the repo that keeps them in sync — confirmed by searching `package.json` scripts and `tsup.config.ts` files in every package, and by the absence of a `.github/workflows/` directory. Full file-by-file comparison (verified 2026-10-04 by diffing every `.ts`/`.tsx` file on both sides):

| Area | Status | Detail |
|---|---|---|
| `orycms/<domain>/*` vs `packages/core/src/<domain>/*` (engine: auth, rbac, content, schema, media, hooks engine, email, plugins, etc.) | **111 files byte-identical**, 7 diverged | Diverged: `auth/auth.ts`, `auth/index.ts`, `auth/token-links.ts`, `core/core.migration.ts`, `hooks/index.ts`, `index.ts` (root barrel), `lib/route-guards.ts`. A fix landed in one does not apply to the other until manually ported — this has already happened at least once (P0-1/P0-2/P0-6/P0-7 all had to be ported by hand). |
| `orycms/components/*` vs `packages/next/src/components/*` (UI) | Mostly identical; dashboard shell diverged | `AppShell.tsx`, `AppSidebar.tsx`, `Dashboard.tsx` are different, unrelated implementations — `packages/next`'s versions are a much simpler, earlier-stage design (e.g. its `AppSidebar` is just one static "Dashboard → /admin" link; the root's is a full permission-gated nav tree). `hooks/use-orycms-session.tsx` also diverged. Collections/content components (`OryCMSCollectionsAdminPage`, `OryCMSContentForm`, `OryCMSContentTable`, etc.) are identical. |
| `orycms/lib/{error-capture,error-page,oryntic-error-reporting}.ts` | **Unique to `orycms/`, no packages/ counterpart** | Not CMS logic at all — `error-capture.ts`'s own comment references "h3" (a server framework used by Vite/Nitro-style tooling, not plain Next.js), indicating these are leftover dev-preview/hosting-environment scaffolding unrelated to OryCMS itself. Belong in the reference app, not in a published package. |
| `packages/core/src/next/{dispatcher,http,routes/*}.ts` | **Unique to packages/core, no `orycms/` counterpart** — **route-complete except 6 auth routes, but almost entirely unwired and barely test-proven** (corrected 2026-10-04, see `internal/PROGRESS.md`'s U1-3 sub-task audit) | 10 files implementing a framework-agnostic route dispatcher meant to be mounted via `createOryCMSRouteHandlers()` from `@ory-cms/core/next`. Only `routes/auth.ts` is wired into `ORYCMS_ROUTES` today (6 session routes: login/logout/me/session/setup/setup-status). **But `collections.ts`, `audit.ts`, `database.ts`, `media.ts`, `roles.ts`, `settings.ts`, `stubs.ts`, `users.ts` are NOT dead code** — a route-by-route count found each already has a pattern-matching, logically-equivalent counterpart for every one of the root's corresponding routes (e.g. `collections.ts`'s 20 route patterns exactly match the root's 20 collections-module methods). The only real gap is 6 of auth's 12 routes (`refresh`, `forgot-password`, `reset-password`, `activate`, `invite`, `accept-invite` — the token-based flows) which have no counterpart anywhere in `packages/core` yet. What's actually missing across the board is (a) wiring every already-ported module into `ORYCMS_ROUTES`, (b) test coverage — only `collections.test.ts` (1 of 20 collections routes) and the auth-only `dispatcher.test.ts`/`mvp-surface.test.ts` exist for this whole directory — and (c) the root's 44 hand-written `app/api/orycms/**/route.ts` files still being a second, independent, non-shared implementation of the same API rather than thin wrappers over this one. All three are being closed module-by-module per `internal/PROGRESS.md`'s U1-3.0–U1-3.12 sub-tasks. |
| `packages/next/src/admin/{OryCMSAdmin,OryCMSLoginPage,OryCMSSetupPage}.tsx` | **Unique to packages/next, no `orycms/`/`app/` counterpart** — and **unused by the root app** | These are the documented "mount this at `app/admin/page.tsx`" entry components (per `OryCMSAdmin.tsx`'s own doc comment). The root app's actual `app/admin/page.tsx`, `app/login/page.tsx`, `app/setup/page.tsx` do **not** import or use them — they're separate, independently written implementations (similar line counts, suggesting a common ancestor that then diverged). Nothing in this repo currently proves these packaged entry components actually work end-to-end for a real consumer. |
| `packages/cli` / `packages/create-orycms` source | **Fixed (U1-1/U1-2, 2026-10-04)** — `create-ory-cms` now depends on `@ory-cms/cli` as a real package dependency | `packages/cli` exposes a `./internal` export subpath (`src/internal.ts`, built by `tsup` alongside the main `index.ts` CLI-binary entry, with its own `.d.ts`) covering exactly what `create-ory-cms` needs (`logger`, `detectNextJs`, `bootstrapAdmin`, `runInit`, the database wizard/migrate/seed functions, and associated types). `create-ory-cms` lists `"@ory-cms/cli": "0.1.5"` in `dependencies` and imports from `@ory-cms/cli/internal` — resolved via the existing npm-workspaces symlink in dev, same pattern as `packages/next`'s `"@ory-cms/core"` dependency. Proved with a real `npm pack` of both packages installed into a fresh project outside the repo (`create-ory-cms --help` runs correctly); see `internal/PROGRESS.md`'s dated log entry for full evidence. `@ory-cms/cli`'s own `dist/index.js` still bundles logic from the root `orycms/` folder via its `tsup` `@` alias (a separate, already-tracked issue, not part of U1-1/U1-2's scope). |

**Planned direction:** unifying these into one source of truth (`packages/*` only, root becomes a consuming demo app) is planned but not yet executed — see `internal/PROGRESS.md`'s Phase 1–7 plan. Everything above describes **current reality**; this section will be rewritten once that plan actually lands, not before.

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
| Change an admin dashboard screen | The matching file under `app/admin/<name>/page.tsx` — every dashboard screen lives under `app/admin/` now, real or still-placeholder alike |
| Change the CLI | `packages/cli/src/` — command registration is in `packages/cli/src/index.ts` |
| Change the scaffolder | `packages/create-orycms/src/` — entry point is `index.ts`, actual logic in `runner.ts` |
| Publish a fix to npm consumers, not just the reference app | Remember to also edit the matching file under `packages/core/src/` or `packages/next/src/` — see "How the packages relate" above |

## Planned target layout (not yet executed)

The proposed end state, once the unification plan in `internal/PROGRESS.md` lands:

```
packages/
├── core/            @ory-cms/core — engine, sole source of truth (today's orycms/ merges in here)
├── next/            @ory-cms/next — admin UI, sole source of truth (today's orycms/components merges in here)
├── cli/             @ory-cms/cli — db:migrate actually wired, version read from package.json
└── create-orycms/   create-ory-cms — takes an app-name argument, scaffolds a fresh directory

apps/
└── demo/            today's repo root (app/, orycms.config.ts, middleware.ts) — becomes a real npm
                      consumer of the four packages above via npm workspaces, not a second copy of their source
```

`orycms/` and the root `app/`'s hand-rolled API routes disappear as separate source — `apps/demo` imports `@ory-cms/core`/`@ory-cms/next` like any external user would, which is also what makes it possible to finally prove those packages work for someone who isn't this repo. The three `orycms/lib/error-*` files (dev-preview/hosting scaffolding, not CMS logic) move to `apps/demo` directly rather than into either package.

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
