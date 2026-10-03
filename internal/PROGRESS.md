# OryCMS — Internal Progress Tracker

**Current version:** core/next `0.1.3`, cli/create-orycms `0.1.5`, root app `0.1.0` (per each `package.json`, unreleased/untagged — see P2-1)
**Last updated:** 2026-10-04
**Overall status:** Pre-alpha. Core (auth/RBAC/sessions/hooks/email/draft-publish/Postgres migrations) is solid and tested. Onboarding (scaffolder, CLI db:migrate), multi-DB support, S3 storage, plugin routes, and most of the admin dashboard are not implemented or are broken as documented. One unauthenticated SQL injection is open — do not deploy against a real database until P0-1 is DONE. Full detail: `AUDIT_REPORT.md` (repo root, internal-only, not for publication — see `internal/FILE_CLASSIFICATION.md`).

This file is the single source of truth for "what's left to do." Every agent session must read it before picking work, and must update it before ending (see `AGENTS.md` end-of-task routine). The task list must always reflect reality — if you find something the audit missed, or a task turns out to be bigger/smaller/different than scoped, edit the table, don't just note it in the log.

---

## Task table

| ID | Priority | Task | Status | Branch | Notes |
|---|---|---|---|---|---|
| P0-1 | P0 | Fix unauthenticated SQL injection in content filter/sort (allowlist field names against collection schema before building SQL) | TODO | — | See `AUDIT_REPORT.md` §3.1 / §4 for exact location. Do not name the vulnerable file/line in commit messages or public issues until a patched version ships — see `AGENTS.md` working rules. |
| P0-2 | P0 | Add missing permission guard to unauthenticated `GET /api/orycms/collections` (schema disclosure) | TODO | — | Same file already has the correct pattern on its `POST` handler — mirror it. |
| P0-3 | P0 | Pin `next` to an exact version (currently `"latest"` in root `package.json`) and resolve `npm audit` findings (1 critical, several high) | TODO | — | Re-run `npm audit` after pinning; distinguish runtime-exposed vulns from dev-toolchain-only ones before deciding what's urgent. |
| P0-4 | P0 | Release a patched version of affected packages and deprecate/yank vulnerable published versions on npm | BLOCKED | — | Blocked on P0-1–P0-3 landing and passing the quality gate. Also blocked on deciding whether `packages/core/src/` needs the same fix ported (see `docs/PROJECT_STRUCTURE.md` "How the packages relate" — it's a separate source tree from root `orycms/`). Requires your explicit go-ahead before any `npm publish` — see `AGENTS.md`. |
| P0-5 | P0 | Remove GitBook secrets from repo | IN_PROGRESS | `chore/remove-gitbook-secrets` | A live GitBook API token was found committed in `.mcp.json` and `.codex/config.toml`. Stripped the GitBook entry/token from both files (now empty of GitBook config, kept on disk) and from `.claude/settings.local.json`'s enabled-servers list (kept its other entry). Ran `git rm --cached` on `.mcp.json` and `.codex/config.toml`. Added `.mcp.json`, `.reticle.json`, `.env`, `.env.*`, `!.env.example` to `.gitignore`. Redacted the token value that had been written into `internal/FILE_CLASSIFICATION.md` by a prior task. **Follow-ups:** token rotated by owner (confirm); decide on git history rewrite (deferred — token remains in commits `7c9dddc` and `3a04965` until then). Not yet committed — awaiting owner review per working rules (no `git commit` run this session). |
| P1-1 | P1 | Fix or re-document `create-ory-cms` app-name/scaffolding behavior | TODO | — | Currently has no positional app-name argument and no directory/template creation logic at all — operates in-place on cwd only. Decide: implement real scaffolding, or rewrite README's "Quick start" to match actual behavior. |
| P1-2 | P1 | Wire up or remove `@ory-cms/cli db:migrate` | TODO | — | The underlying migration/seed code exists and is tested under `packages/cli/src/commands/init/database/` but is never registered as a CLI command. Either add the command or stop telling README readers to run it. |
| P1-3 | P1 | Fix hardcoded CLI version string | TODO | — | `packages/cli` reports `0.1.0` regardless of actual published version. |
| P1-4 | P1 | Rewrite README honestly: Postgres-only today, add a "Planned" section for S3/MySQL/Mongo/Firebase/Oracle/plugin-routes/commerce/SEO/analytics | TODO | — | Must not claim anything as done that isn't tested working — see `AGENTS.md` working rules. |
| P1-5 | P1 | Remove `NEXTAUTH_SECRET`/`NEXTAUTH_URL` from README env var docs | TODO | — | Zero code references anywhere; next-auth isn't used. Pure documentation fix. |
| P1-6 | P1 | Mark unimplemented DB adapters clearly (MySQL/Mongo/Firebase/Oracle) | TODO | — | Either remove from public API surface or add a loud runtime warning when selected; currently they register silently next to the real Postgres adapter. |
| P2-1 | P2 | Git tags + CHANGELOG sync for all four packages | TODO | — | No git tags exist at all; CHANGELOGs are stale relative to `package.json` versions (core/next stuck at 0.1.0 docs, cli/create-orycms stuck at 0.1.2 docs). |
| P2-2 | P2 | Untrack generated/internal files from git (see `internal/FILE_CLASSIFICATION.md` proposed commands) | TODO | — | Requires your approval — the commands are proposed, not run, by design. |
| P2-3 | P2 | Delete stale `packages/create-orycms/create-orycms-0.1.0.tgz` | TODO | — | Superseded build artifact from before the 0.1.2 ESM-loader fix. |
| P2-4 | P2 | Resolve the dead `orycms/services/*.service.ts` facade layer | TODO | — | ~90 "Not implemented" throws across auth/database/roles/media/settings/collections/plugins/content/users/seo services; real logic lives in `*.engine.ts`/`*.repo.ts` instead. Either finish this layer or delete it — currently pure confusion with no function. |
| P2-5 | P2 | Fix Prettier formatting so `npm run lint` is a clean gate | TODO | — | 266 of 269 current lint errors are Prettier-only; `npm run format` should clear nearly all of them. One real rule violation remains (`@typescript-eslint/no-require-imports` in a create-orycms test file) and needs an actual code fix, not just formatting. |
| P2-6 | P2 | Add a CI workflow | TODO | — | No `.github/workflows/` exists at all today — typecheck/lint/build/test currently only run locally/manually. |
| P2-7 | P2 | Add integration tests against a real Postgres instance | TODO | — | Current tests mock `pg.Pool` entirely (confirmed for the Postgres adapter and others) — no test currently proves generated SQL is correct against a live database. |
| P2-8 | P2 | Fix `docs/ARCHITECTURE.md` contradictions | TODO | — | Describes a `src/app/...` path that doesn't exist (actual root is `app/`) and markets commerce/SEO/plugin features as built pillars while elsewhere admitting v1 is "foundational architecture... placeholder pages." |
| P3-1 | P3 | Implement real S3/object storage | TODO | — | Not started. Media engine currently writes to local disk only; no S3 SDK dependency exists anywhere in the repo. |
| P3-2 | P3 | Implement plugin-contributed routes | TODO | — | Not started. Registry exists and stores handlers but never mounts them to actual Next.js routing — confirmed dead code via repo-wide grep for its only accessor. |
| P3-3 | P3 | Implement MySQL adapter | TODO | — | Not started. All 12 interface methods currently throw `Not implemented`; `mysql2` isn't even a dependency. |
| P3-4 | P3 | Implement MongoDB adapter | TODO | — | Same pattern as P3-3, `mongodb` driver missing. |
| P3-5 | P3 | Implement Firebase adapter | TODO | — | Same pattern as P3-3, `firebase-admin` missing. |
| P3-6 | P3 | Implement Oracle adapter | TODO | — | Same pattern as P3-3, `oracledb` missing. |
| P3-7 | P3 | Build real richText/relation/media admin UI editors | TODO | — | Current UI for these three field types literally renders placeholder text ("coming in a future release") with a raw text/UUID input as a stopgap. |
| P3-8 | P3 | `@ory-cms/react` package | TODO | — | Not started — README lists it as "coming soon." |
| P3-9 | P3 | `@ory-cms/plugin-sdk` package | TODO | — | Not started — README lists it as "coming soon." |
| P3-10 | P3 | Commerce modules (products/orders/customers/inventory) | TODO | — | Not started — current routes/pages for these are explicit 501 stubs or static placeholder/mock UI. |

---

## Log (newest first)

### 2026-10-04 — Remove GitBook secrets from repo (branch: `chore/remove-gitbook-secrets`)
- **Task:** P0-5. A live GitBook API token (prefix `gb_api_`) was found committed in `.mcp.json` and `.codex/config.toml`. Owner is rotating the token directly in GitBook; this task only cleans the repo.
- **Searched** the working tree for "gitbook" (case-insensitive) and the `gb_api_` token prefix. Note: this environment's `grep` is `ugrep`, which by default silently respects `.gitignore` and skips hidden directories during recursive search — required `--hidden --no-ignore-files` to get a complete picture, since `.codex/` and `.claude/` are now gitignored from a prior session. Also searched for `GITBOOK_*` env-var-style names — none found anywhere, confirming no env-var-based config exists yet.
- **Files touched:**
  - `.mcp.json` — removed the `gitbook` MCP server entry (the file's only entry); now `{"mcpServers": {}}`. Untracked via `git rm --cached` (kept on disk). **Flagging for owner:** this file now serves no purpose — consider deleting it if no other MCP server config is needed locally.
  - `.codex/config.toml` — removed the `[mcp_servers.gitbook]` block (the file's only content); now empty. Untracked via `git rm --cached` (kept on disk). **Flagging for owner:** same as above — consider deleting if unused.
  - `.claude/settings.local.json` (untracked, local-only file) — removed `"gitbook"` from `enabledMcpjsonServers`, kept `"code-review-graph"`.
  - `.gitignore` — added `.mcp.json`, `.reticle.json`, `.env`, `.env.*`, `!.env.example` (explicitly requested; `.reticle.json` itself was left tracked since untracking it is unrelated to GitBook and out of this task's scope).
  - `internal/FILE_CLASSIFICATION.md` — redacted the literal token value that a prior task had written into its "Sensitive findings" section (now `gb_api_[REDACTED]`), added a "Policy for future tooling credentials" note (env-var only, never a tracked config file), and updated its proposed-commands section to reflect that two of the `git rm --cached` commands have now actually been run.
  - `internal/GITIGNORE_PROPOSAL.md` — updated to mark the GitBook-related `.gitignore` lines as applied, and separated out the still-unapplied, unrelated lines (`internal/`, `AUDIT_REPORT.md`, `next-env.d.ts`, `*.tsbuildinfo`, `*.tgz` — tracked under P2-2 instead).
- **Verification:** re-ran the `gb_api_` search across the full working tree (hidden dirs included, `.gitignore` bypassed) — the only remaining matches are the redacted placeholder and a bare-prefix mention inside an example command, both in `internal/FILE_CLASSIFICATION.md`; no real token value remains anywhere in the working tree. Checked `git log --all -S"gb_api_" --oneline` (covers all local and remote-tracking branches) and `git stash list` (empty) — the token still exists in two historical commits, hashes only: `3a04965`, `7c9dddc`.
- **Not done (explicitly out of scope / deferred):** no `git commit`, `git push`, or history rewrite was run. README.md's and `docs/`'s public `app.gitbook.com` documentation links were left untouched (reported only, not edited) — 9 links in `README.md`, none in `internal/FILE_CLASSIFICATION.md` besides the one explanatory mention. `.reticle.json` and `.claude/settings.json` were left tracked (unrelated to GitBook).
- **Follow-ups:** token rotated by owner (confirm); decide on git history rewrite (deferred).

### 2026-10-04 — Documentation and agent workflow set up
- Created `docs/PROJECT_STRUCTURE.md` (public): architecture overview, directory tree, package relationship, request flow, "where to change what," npm scripts.
- Created `internal/FILE_CLASSIFICATION.md`: classified every top-level file/folder as PUBLIC/INTERNAL/GENERATED with git-tracked status; found a live API credential committed in `.mcp.json` and `.codex/config.toml` (see that file for detail — not repeated here to avoid duplicating sensitive content across files unnecessarily, though this is itself the internal/ directory so either location is appropriately access-controlled).
- Created `internal/GITIGNORE_PROPOSAL.md`: proposed (not applied) `.gitignore` additions for `internal/`, `AUDIT_REPORT.md`, `.mcp.json`, `.reticle.json`, `next-env.d.ts`, `*.tsbuildinfo`, `*.tgz`.
- Merged new sections into `AGENTS.md` (kept the existing Lovable notice intact), created `CLAUDE.md` pointing to it.
- Created this file (`internal/PROGRESS.md`), seeded from `AUDIT_REPORT.md`'s prioritized action plan.
- Verified by reading source: root `orycms/` and `packages/core/src/`+`packages/next/src/` are independently maintained, already-diverging source trees with no build/sync relationship (no CI, no copy script found anywhere in the repo).
- Did not change any source code, run any git-history-modifying or publish commands, or delete/move/rename any existing file, per this task's hard rules.

---

## Decisions

_(Architectural decisions get logged here as they're made — empty until the first one.)_

| Date | Decision | Rationale | Made by |
|---|---|---|---|
| | | | |
