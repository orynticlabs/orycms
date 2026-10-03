# File Classification — INTERNAL, do not publish

This file lives in `internal/`, which is proposed to be gitignored (see `internal/GITIGNORE_PROPOSAL.md`). It classifies every top-level file/folder in the repo as it exists today. "Tracked by git?" was checked with `git ls-files` (read-only).

Legend: **PUBLIC** = belongs in the open-source repo · **INTERNAL** = should not be in the public repo · **GENERATED** = build/tool output, should never be committed.

| Path | Bucket | Reason | Tracked by git? |
|---|---|---|---|
| `.claude/` | INTERNAL | AI tool config. `.claude/settings.json` is tracked and contains only a plugin-enable flag (no secret found). `.claude/settings.local.json` exists locally but is **not** tracked — good, keep it that way. | `settings.json`: **yes**. `settings.local.json`: no |
| `.codex/` | INTERNAL | AI tool config. `.codex/config.toml` is tracked **and contains a live credential** — see "Sensitive findings" below. | **yes** |
| `.github/` | PUBLIC | Issue templates, PR template, funding config — standard open-source community files. Checked each file; no tokens or private info. | yes |
| `.gitignore` | PUBLIC | Standard tooling file. | yes |
| `.mcp.json` | INTERNAL | MCP server config. **Contains a live credential** — see "Sensitive findings" below. | **yes** |
| `.prettierignore` / `.prettierrc` | PUBLIC | Standard tooling config, no sensitive content. | yes |
| `.reticle.json` | INTERNAL | Third-party dev-tool project-linkage file (`projectId`). Not a secret by itself, but it's workspace/account-specific metadata with no value to an open-source consumer. | yes |
| `AGENTS.md` | PUBLIC | Agent/contributor instructions (this task merges new sections into it). No sensitive content. | yes |
| `app/` | PUBLIC | Next.js application source (pages + API routes). Spot-checked for hardcoded secrets/paths — none found. | yes |
| `AUDIT_REPORT.md` | INTERNAL | Contains exact vulnerable file:line references and unpatched vulnerability details (critical SQLi). Per the hard rule for this task, this kind of detail must stay out of anything public. **It currently sits at the repo root, not under `internal/`,** and per this task's hard rules I cannot move/rename it. **Not yet tracked by git** (shows as untracked in `git status`) — this is good news: it has never been committed, so there's still a clean window to relocate or gitignore it before it enters history. Flagged in "Sensitive findings" and the chat report. | **no (untracked)** |
| `CODE_OF_CONDUCT.md` | PUBLIC | Community file. Note: file is 1 byte — effectively empty/unfinished, but that's a content gap, not a classification issue. | yes |
| `components.json` | PUBLIC | shadcn/ui generator config, no sensitive content. | yes |
| `CONTRIBUTING.md` | PUBLIC | Community file. | yes |
| `docs/` | PUBLIC | `ARCHITECTURE.md`, `NAMING_CONVENTIONS.md` (pre-existing), plus the new `PROJECT_STRUCTURE.md` from this task. No sensitive content; `ARCHITECTURE.md` has known accuracy problems (tracked in `internal/PROGRESS.md`, not a classification issue). | yes (existing two files); `PROJECT_STRUCTURE.md` new, untracked |
| `eslint.config.js` | PUBLIC | Tooling config. | yes |
| `instrumentation.ts` | PUBLIC | App source (startup hook). | yes |
| `LICENSE` | PUBLIC | MIT license text. | yes |
| `middleware.ts` / `middleware.test.ts` | PUBLIC | App source + test. Read in full — no secrets, only route-matching logic. | yes |
| `next-env.d.ts` | **GENERATED** | Next.js auto-generates this file on every `next dev`/`next build`; it should never be hand-edited or committed. It **is currently tracked**, which is a hygiene bug (it's in `git status` as locally modified right now simply from running the dev/build tooling). | **yes (should not be)** |
| `next.config.ts` | PUBLIC | Tooling config (currently empty). | yes |
| `orycms/` | PUBLIC | CMS engine source used by the root app. See `docs/PROJECT_STRUCTURE.md` for its relationship to `packages/core`/`packages/next`. | yes |
| `orycms.config.ts` | PUBLIC | Root app's sample collection config. | yes |
| `package-lock.json` | PUBLIC | Lockfile — correctly committed (this one *should* be tracked). | yes |
| `package.json` | PUBLIC | Root workspace manifest. | yes |
| `packages/` | PUBLIC | The four publishable packages' source, except the stale artifact noted below. | yes |
| `packages/create-orycms/create-orycms-0.1.0.tgz` | **GENERATED** (stale build artifact) | A packed tarball of an old (0.1.0) build, superseded by the current 0.1.5 and by a documented bug fix (CHANGELOG 0.1.2). Not referenced by any `files` field or script. Should never have been committed. | **yes (should not be)** |
| `postcss.config.mjs` | PUBLIC | Tooling config. | yes |
| `public/` | PUBLIC | Static assets. | yes |
| `README.md` | PUBLIC | Project README. Known accuracy problems are tracked in `internal/PROGRESS.md` (P1), not a classification issue. | yes |
| `SECURITY.md` | PUBLIC | Vulnerability-reporting policy — correctly says not to disclose vulnerabilities publicly first. | yes |
| `SUPPORT.md` | PUBLIC | Community file. | yes |
| `tsconfig.json` | PUBLIC | TypeScript config. | yes |
| `tsconfig.tsbuildinfo` | **GENERATED** | `tsc --incremental` build cache. Should never be committed — contents are just compiler bookkeeping, not meaningful source. **Currently tracked**, and shown as locally modified by the mere act of running `tsc`. | **yes (should not be)** |
| `vitest.config.ts` | PUBLIC | Test runner config. | yes |
| `internal/` (this directory) | INTERNAL | Created by this task: `FILE_CLASSIFICATION.md`, `PROGRESS.md`, `GITIGNORE_PROPOSAL.md`. Must never be committed. | no (new, untracked) |
| `CLAUDE.md` | PUBLIC | Created by this task: one-line pointer to `AGENTS.md`. No sensitive content. | no (new, untracked) |

Not committed and correctly absent (verified `git ls-files` returns nothing): `node_modules/`, `.next/`, `dist/` (any package), `*.env`. No `.env` file of any kind exists in the working tree at all.

## Sensitive findings (read carefully)

1. **Live credential committed to git, twice.** A GitBook API token (prefix `gb_api_[REDACTED]`, used as an `Authorization` header) appears in:
   - `.mcp.json` (`mcpServers.gitbook.headers.Authorization`)
   - `.codex/config.toml` (`mcp_servers.gitbook.http_headers.Authorization`)
   Both files are **currently tracked by git**. `git log --all -- .mcp.json` shows it was introduced in commit `7c9dddc`; `git log --all -- .codex/config.toml` shows commit `3a04965`. A read-only search (`git log --all -p -- .mcp.json .codex/config.toml | grep -c gb_api_`) confirms the token string appears in the committed history, not just the working tree. **This task does not rotate or remove it** (no source changes, no git history rewriting per the hard rules) — that decision and action belongs to you. If this repository is or ever becomes public, treat this token as compromised and rotate it at the GitBook end regardless of what's done to the repo.
   Note: since this task started, `.gitignore` was updated (in a prior session) to ignore `.claude` and `.codex` going forward — but **gitignoring does not untrack already-committed files**. Both `.mcp.json` and `.codex/config.toml` remain tracked and will keep showing up in every future commit/clone until explicitly untracked (see the proposed command below) and, for full remediation, until the token itself is rotated and the two commits are scrubbed from history if this repo is meant to go public clean (history rewriting is out of scope for this task and requires your explicit decision per `AGENTS.md`'s working rules).
   **Update (see `internal/PROGRESS.md` task for "Remove GitBook secrets from repo"):** a follow-up task on branch `chore/remove-gitbook-secrets` has since stripped the GitBook entries from both files and run `git rm --cached` on them (owner is rotating the token separately in GitBook). The literal token value that was briefly written into this file has been redacted to `gb_api_[REDACTED]`. The commits above still contain the old token in history pending a decision on history rewriting.
2. **`AUDIT_REPORT.md` at the repo root contains precise vulnerability file:line details** for the unpatched SQL injection described in `internal/PROGRESS.md` P0-1. It is currently untracked (never committed), which is the best possible state for it to be in right now — recommend keeping it that way (gitignore it, or move it under `internal/`) until the fix ships. I did not move it myself because this task's hard rules forbid moving/renaming existing files.
3. No other hardcoded secrets, API keys, passwords, or private-key material were found in any tracked file (spot-checked `.github/`, `components.json`, config files, and re-confirmed the prior audit's repo-wide secret grep found nothing else).
4. No `.env` file of any kind exists in the working tree or git history.

## Policy for future tooling credentials (GitBook or otherwise)

If a GitBook (or any other third-party) API token is needed for local tooling again in the future, it must be supplied via an environment variable (e.g. `GITBOOK_API_TOKEN`, read at runtime) or a local, gitignored file such as `.mcp.local.json`/`.env` — **never** written directly into a tracked config file like `.mcp.json` or `.codex/config.toml`. Both of those files are now gitignored (see `.gitignore`), but gitignoring only prevents *future* accidental commits — it is not a substitute for not putting secrets in the file in the first place, since anyone with local disk access to a cloned-before-ignore copy, or any tool that reads the working tree, can still read a committed-pattern file if someone re-adds it with `git add -f`.

## Proposed `.gitignore` additions

See `internal/GITIGNORE_PROPOSAL.md` for the full diff-style proposal. Not applied — for your review.

## Proposed commands to untrack files (DO NOT RUN — for your review)

```bash
# Generated files that should never have been committed:
git rm --cached next-env.d.ts
git rm --cached tsconfig.tsbuildinfo
git rm --cached packages/create-orycms/create-orycms-0.1.0.tgz

# AI tooling configs unrelated to GitBook — still proposed, not run by the
# GitBook-cleanup task (out of its scope: "do not touch anything unrelated
# to GitBook"):
git rm --cached .claude/settings.json
git rm --cached .reticle.json
```

**Already done** (on branch `chore/remove-gitbook-secrets`, not yet committed — see `internal/PROGRESS.md`): `git rm --cached .mcp.json` and `git rm --cached .codex/config.toml` were run, after the GitBook entry/token was stripped from both files' contents (they remain on disk, now empty of GitBook config). This does **not** remove the GitBook token from git history — that requires a history rewrite (`git filter-repo` or equivalent), which is explicitly out of scope for this task and should only be done after the token is rotated (owner is doing this separately in GitBook).
