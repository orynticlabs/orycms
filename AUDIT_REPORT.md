# OryCMS — Honest Engineering Audit

**Date:** 2026-10-04
**Scope:** full monorepo at current `main` (commit `b62abbc`), read-only review. No files were modified, no destructive/state-changing commands were run beyond `npm install`, `npm run typecheck/lint/build/test`, and read-only `git`/`curl`/`grep` commands.
**Method:** direct inspection plus six focused sub-audits (database/migrations, auth/RBAC/session security, collections/fields/API/admin-UI, media/plugins/email/hooks, packages/scaffolder/CLI, TODO/dead-code/secrets scan). Every claim below is backed by a file:line citation or a command output. Anything I could not verify is marked **UNVERIFIED**.

---

## 1. Executive summary

OryCMS is a self-hosted, Postgres-backed content engine embedded in a Next.js app, with a genuinely solid core: authentication, session handling, RBAC, lifecycle hooks, draft/publish states, transactional/idempotent migrations, and a 7-provider email system are all real, working, and reasonably well-tested. Everything else the README sells as a finished product is not. Four of the five advertised database adapters (MySQL, MongoDB, Firebase, Oracle) are 100%-stub — every interface method throws `"Not implemented"` and the required drivers aren't even dependencies. The plugin system can discover and install plugins but cannot actually mount a plugin's routes — that registry is provably dead code. "S3 storage" doesn't exist; media only writes to local disk. Most of the admin dashboard (analytics, customers, orders, products, inventory, marketing, SEO, categories, database) is placeholder pages or screens built on hardcoded mock arrays. Both of the README's two onboarding paths are broken as documented: `npx create-ory-cms my-app` has no app-name argument or scaffolding logic at all, and `npx @ory-cms/cli db:migrate` is not a registered CLI command. There is one confirmed **unauthenticated SQL injection** vulnerability and one unauthenticated schema-disclosure endpoint. Given a core that's ~70% solid wrapped in a product surface (onboarding, multi-DB, dashboard, plugin extensibility, storage) that's largely unbuilt or broken, **I'd put overall completion against the README's claims at roughly 35–40%**. This is pre-alpha software marketed with 1.0-style confidence; it should not be installed against a real database today without the SQLi fix.

---

## 2. Status table

| Feature | Status | Key evidence |
|---|---|---|
| Collections / schema engine | COMPLETE (Postgres) | `orycms/schema/*`, idempotent, real validator |
| 13 field types — schema layer | COMPLETE | `orycms/schema/collection.schema.ts` |
| 13 field types — admin UI | PARTIAL | richText/relation/media are literal "coming in a future release" stubs |
| 13 field types — validation | PARTIAL | only boolean/email/select enforce constraints; minLength/maxLength/pattern/min/max/unique declared but unenforced |
| Admin dashboard | PARTIAL/STUB | collections screen real; analytics/customers/orders/products/inventory/marketing/SEO/categories/database/top-level-roles/users are placeholders or mocked data |
| REST API (`/api/orycms/*`) | PARTIAL | most routes real with auth+error handling; 12 routes are explicit 501 stubs; 1 unauthenticated info leak; 1 unauthenticated SQLi |
| Authentication | COMPLETE | bcrypt cost 12, CSPRNG session tokens, hashed at rest, correct cookie flags |
| NEXTAUTH_* env vars | MISSING/FICTION | zero code references outside README |
| Roles & permissions (5 roles) | COMPLETE | server-enforced via `guardOryCMS`, not just UI-hidden |
| Draft/published states | COMPLETE (Postgres-only) | valid state machine, hooks fire, public reads exclude drafts |
| Media library (local) | COMPLETE | MIME allowlist, 50MB cap, UUID filenames |
| S3 / object storage | MISSING | no S3 SDK dependency anywhere; local disk only |
| Plugin discovery/install/manifest | COMPLETE | real, tested |
| Plugin-contributed routes | STUB (dead) | handlers stored, never mounted — code admits it |
| Lifecycle hooks | COMPLETE | 28 real hook points, genuinely invoked from engines |
| Email | COMPLETE | 7 providers, wired to invite/reset/activation flows |
| DB adapter: PostgreSQL | PARTIAL | real, but tested only against a mocked `pg.Pool`, no live-DB test |
| DB adapter: MySQL | STUB | 12/12 methods throw `Not implemented`; no `mysql2` dependency |
| DB adapter: MongoDB | STUB | same pattern; no `mongodb` dependency |
| DB adapter: Firebase | STUB | same pattern; no `firebase-admin` dependency |
| DB adapter: Oracle | STUB | same pattern; no `oracledb` dependency |
| Migrations | COMPLETE (Postgres-only), genuinely idempotent | applied-migration tracking + transactions |
| `create-ory-cms` scaffolder | BROKEN vs. README | no positional app-name arg, no directory/template creation |
| `@ory-cms/cli init` | PARTIAL | works, fails cleanly if no Next.js detected |
| `@ory-cms/cli db:migrate` | MISSING | not a registered command at all |
| Build / typecheck | COMPLETE | `tsc --noEmit` clean; `next build` succeeds |
| Lint | PARTIAL | 266/269 issues are pure Prettier formatting; 1 real rule violation |
| Tests | COMPLETE (mostly) | 1319/1323 pass; 4 failures are missing-prebuilt-dist smoke tests, not logic bugs |

---

## 3. Critical bugs and blockers, ranked

1. **Unauthenticated SQL injection** — `app/api/orycms/collections/[collection]/content/route.ts` (GET) never calls a permission guard, and `middleware.ts`'s `PUBLIC_CONTENT_GET_RE` explicitly whitelists this path for unauthenticated GET. Query-string `filter[FIELD][OP]` and `sort` values flow unvalidated into `orycms/content/content.engine.ts:55-56` (`` `"${f.field}"` ``) and `:147` (sort clause), then straight into raw SQL text at `:150-162`. A `"` in the field name breaks out of the identifier and injects SQL. **This is exploitable by anyone, with no account, against any public collection.** Fix before this touches a real database.
2. **`npx create-ory-cms my-app` does not work as documented.** `packages/create-orycms/src/index.ts:17-20` registers no positional app-name argument. There is no `mkdir`, no template directory, no fresh-project logic anywhere in `runner.ts`. The command only operates in-place on the current working directory (effectively `@ory-cms/cli init` + optional DB seed). The README's very first code block fails.
3. **`npx @ory-cms/cli db:migrate` does not exist.** `packages/cli/src/index.ts` registers only `init`, `plugin`, `config`. The entire tested `commands/init/database/` subtree (connection, migrations, seeder, wizard) is never imported into the command tree. Running the command the README tells existing-project users to run returns "unknown command." This breaks the second of the README's two documented onboarding paths completely.
4. **4 of 5 advertised database adapters are non-functional stubs** with no corresponding driver dependency installed (`mysql2`, `mongodb`, `firebase-admin`, `oracledb` are absent from `packages/core/package.json`). `orycms/database/registry.ts:30-34` registers all five identically with no warning — a user who configures `database.adapter: "mysql"` gets silent success at config time and a crash on first query.
5. **Unauthenticated schema disclosure** — `GET /api/orycms/collections` has no auth check at all while `POST` on the same file is correctly guarded; anyone can enumerate the full collection schema.
6. **Plugin routes are dead.** `plugin.routes.ts` itself documents "Handlers are stored but never executed by this registry" — confirmed via repo-wide grep that `getOryCMSPluginRoutes()` has no caller. A plugin author who adds an API route gets silent no-op.
7. **CLI reports the wrong version.** `packages/cli/src/index.ts:10` hardcodes `.version("0.1.0")` while `package.json` says `0.1.5` — `orycms --version` lies to users.
8. **Most of the admin dashboard is not real.** Analytics, categories, customers, database, inventory, marketing, products, SEO, and the top-level roles/users/collections/content routes render static `PlaceholderPage` components or (in the case of `app/orders/page.tsx`) large hardcoded mock arrays presented as live data.

---

## 4. Security findings, ranked

| Severity | Finding | Evidence |
|---|---|---|
| **Critical** | Unauthenticated SQL injection via `filter[...]`/`sort` on public content-list GET | `app/api/orycms/collections/[collection]/content/route.ts:19-28`; `orycms/content/content.engine.ts:55-56,147,150-162` |
| **High** | Unauthenticated info disclosure — full collection schema listable by anyone | `app/api/orycms/collections/route.ts:14-18` (no guard) vs. `:24-25` (POST correctly guarded) |
| **High** | `next` pinned to `"latest"` in root `package.json`; `npm audit` flags a **critical** advisory against the resolved `next` version plus multiple high-severity transitive toolchain vulnerabilities (fast-glob, braces, micromatch, js-yaml, sharp, postcss, nanoid, brace-expansion) | `package.json:46` (`"next": "latest"`); `npm audit --json` output, 16 vulnerabilities (1 critical, 11 high) |
| **Medium** | No CSRF token mechanism anywhere; relies solely on `sameSite=lax` + JSON-body convention | repo-wide grep for CSRF, zero hits in `orycms/auth`, `orycms/rbac` |
| **Low** | `middleware.ts` only checks cookie *presence*, not validity, before letting requests reach handlers (routes re-check, so not exploitable, but inconsistent "deny at the edge" design) | `middleware.ts:62-69` |
| **Low** | Insecure-by-default: Content-Security-Policy disabled by default | `orycms/config/config.defaults.ts:24-26` (`security: { contentSecurityPolicy: false }`) |
| **Informational** | README documents `NEXTAUTH_SECRET`/`NEXTAUTH_URL` as required env vars that do nothing — operators may believe they've configured something they haven't | `README.md:165-166`; zero code references confirmed via grep |

**What's actually solid, confirmed, no issues found:** bcrypt password hashing at cost factor 12 with dummy-hash timing-safe comparison on login; session tokens are `crypto.randomBytes(32)` hex, SHA-256-hashed at rest, never stored or logged in plaintext; cookies set `httpOnly`, `secure` in production, `sameSite: "lax"`; no hardcoded secrets, API keys, or credentials found anywhere in tracked source or git history (`git log -p --all` on env/secret/credential paths is empty); file uploads use an allowlist, a 50MB cap, and `crypto.randomUUID()` filenames (no path-traversal vector from user input).

---

## 5. Published to npm but shouldn't be (or should be beta-tagged)

- **`create-ory-cms`** should not be advertised as the project's quick-start path — it doesn't do what its own README and the main README's "Quick start" section claim. At minimum, tag it `beta` and fix the README until the app-name/scaffolding behavior exists.
- **`@ory-cms/core`'s MySQL, MongoDB, Firebase, and Oracle adapters** should either be removed from the public API surface or the package should ship with a loud runtime warning ("this adapter is not implemented") rather than registering silently alongside the real Postgres adapter. As published today, picking any of these four in config is a footgun with no guardrail.
- **`packages/create-orycms/create-orycms-0.1.0.tgz`** — a stale, already-superseded build artifact (version 0.1.0 against a current 0.1.5, containing the pre-fix broken nested-`dist` path structure that the 0.1.2 CHANGELOG says was fixed) is tracked in git. It isn't part of the npm tarball (not in `files`), but it's garbage sitting in the source repo and should be removed.
- **`@ory-cms/cli`'s `db:migrate` surface** (the whole `commands/init/database/` subtree) is fully built and tested but unreachable from the actual CLI — either wire it up or stop advertising the command in the README.
- None of the four packages have a single git tag corresponding to any of their published versions (`git tag --list` is empty) — there's no way to audit what shipped in 0.1.1–0.1.3 or 0.1.3–0.1.5 for core/next and cli/create-orycms respectively, since the CHANGELOGs are also frozen at older versions (core/next stop at `[0.1.0]`, cli/create-orycms stop at `[0.1.2]`). This should block any further publish until tags + CHANGELOG entries catch up.

---

## 6. Prioritized action plan

**Fix immediately (before any real deployment):**
1. Allowlist `field` names against the collection's actual schema columns before building any SQL fragment in `content.engine.ts` (filters and sort) — closes the critical SQLi.
2. Add the missing `guardOryCMS` call to `GET /api/orycms/collections`.
3. Pin `next` to an exact, audited version instead of `"latest"`; run `npm audit fix` for the rest and re-check for runtime (not just dev-toolchain) exposure.

**Fix before calling this a 1.0 / before onboarding any real users:**
4. Either implement `npx create-ory-cms <app-name>` for real (directory creation, template copy) or change the README to document what the tool actually does (in-place setup).
5. Wire the existing, tested database/migration/seed code into `@ory-cms/cli` as an actual `db:migrate` command, or remove the claim from the README.
6. Fix the CLI's hardcoded version string.
7. Decide, honestly, whether MySQL/MongoDB/Firebase/Oracle support is a real near-term goal. If not, strip them from the README/CHANGELOG now and ship Postgres-only; if yes, put them behind a clear "experimental/unimplemented" flag until the interface methods have bodies and the drivers are dependencies.

**Cut from the README today, mark "planned" instead:**
- S3/object storage (doesn't exist).
- Plugin-contributed API routes (dead code).
- Commerce (products/orders/customers/inventory), SEO tooling, analytics, marketing — all are placeholder/mocked screens or 501-stub routes, despite `docs/ARCHITECTURE.md` describing them as built pillars (that doc itself admits elsewhere it's describing "placeholder pages" — fix the doc's internal contradiction too).
- The "13 field types" claim is accurate for the schema layer but should note that richText/relation/media have no real editing UI yet.

**Process fixes:**
- Start tagging releases in git and keep CHANGELOGs current — right now there's no way to audit what's in any shipped version.
- Delete the stale `create-orycms-0.1.0.tgz` from the repo.
- Resolve the dead `orycms/services/*.service.ts` facade layer (~90 "Not implemented" throws across auth/database/roles/media/settings/collections/plugins/content/users/seo) — it's unused scaffolding that adds confusion with no function; either finish it or delete it.
- Run `npm run format` (or `eslint --fix`) to clear the 266 Prettier-only lint errors so `npm run lint` is a meaningful CI gate again.
- Add integration tests against a real (containerized) Postgres instance — current tests mock `pg.Pool` entirely, so there is zero confidence the SQL actually run against a live database is correct beyond what manual testing has caught.
- A realistic path to a stable 1.0 is: fix the critical SQLi and onboarding breakage first, cut scope to Postgres + core CMS features only, be honest in the README about what's placeholder, then revisit multi-DB/S3/plugin-routes/commerce as clearly-labeled post-1.0 milestones.

---

*Report generated via direct code inspection, `npm install`/`typecheck`/`lint`/`build`/`test` runs, `npm audit`, public GitHub Issues API (unauthenticated), and git history search. No files other than this report were created or modified.*
