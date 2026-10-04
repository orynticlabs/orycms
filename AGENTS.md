<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# OryCMS — Agent Instructions

## 1. Project summary and honest status

OryCMS is an **embeddable CMS library** — installed via npm into a user's own Next.js app, similar in shape to Payload CMS — not a standalone hosted service. It ships as four packages: `@ory-cms/core` (engine), `@ory-cms/next` (admin UI), `@ory-cms/cli`, and `create-ory-cms` (scaffolder). The root of this repo is simultaneously a reference/dev app (`app/`, `orycms/`) that exercises the same engine code directly. Authentication, sessions, RBAC, lifecycle hooks, draft/publish states, Postgres migrations, and email are real, working, and tested.

**Scope decision: PostgreSQL (Neon) only.** Other database adapter code exists in source but is out of scope going forward — see honest status below. The admin UI is mounted at `/admin` (verified: `app/admin/collections`, `app/admin/content` exist). Target env vars are `DATABASE_URL` (pooled, app runtime) and `DATABASE_URL_UNPOOLED` (direct connection, migrations) — **this is the target naming, not yet implemented.** Verified against source on 2026-10-04: `orycms/lib/db.ts` and `orycms/core/bootstrap.ts` currently read `process.env.ORYCMS_DATABASE_URL` instead. Migrating to the `DATABASE_URL`/`DATABASE_URL_UNPOOLED` split is planned work — log it in `internal/PROGRESS.md` if it isn't already tracked there, and don't treat it as done until the source actually uses those names.

**Honest current status — do not contradict this in any public-facing edit:** Postgres is the only working database adapter in source today (MySQL/MongoDB/Firebase/Oracle adapters are present but out of scope per the decision above, and were stubs regardless). S3 storage, plugin-contributed routes, and most of the admin dashboard (analytics, customers, orders, products, inventory, marketing, SEO, categories) are not implemented, or are placeholder/mock UI. Both documented onboarding commands (`npx create-ory-cms my-app`, `npx @ory-cms/cli db:migrate`) are broken as written in the README. There is at least one open, unpatched security issue. **See `internal/PROGRESS.md` for the full, maintained task list and current status of every feature — treat it as more current than this summary.**

## 2. Git and release rules (mandatory)

**These rules supersede anything elsewhere in this file that talks about branching or committing.** Earlier sections below were written before this policy existed; where they conflict, this section wins.

- **Never run a git write command.** This means: `git add`, `git commit`, `git push`, `git branch`, `git checkout`, `git switch`, `git merge`, `git rebase`, `git reset`, `git stash`, `git tag`, `git rm`, or anything else that changes git state (staged files, HEAD, branches, refs, remotes). Read-only commands (`git status`, `git diff`, `git log`, `git show`) are fine and encouraged.
- **Never create a branch.** Work directly in the working tree on whatever branch is currently checked out. Do not switch branches either.
- **Never push.**
- **Leave every change uncommitted.** The owner reviews everything with `git diff` and makes all commits themselves.
- **Never run `npm publish`, `npm deprecate`, `npm unpublish`, or any version bump** (hand-editing a `version` field in a `package.json` counts as a version bump — don't).
- **When a task is finished,** report: a list of changed files, a suggested branch name, and a suggested commit message. The owner runs the actual git commands.

## 3. Mandatory start-of-session routine

Before doing anything else, in this order:
1. Read this file (`AGENTS.md`) in full.
2. Read `docs/PROJECT_STRUCTURE.md`.
3. Read `internal/PROGRESS.md`.
4. Pick the highest-priority task in `internal/PROGRESS.md`'s task table that is not `DONE` and not `BLOCKED`. Work P0 before P1 before P2 before P3, top to bottom within a priority tier, unless the user tells you otherwise.
5. Work on **one task at a time**. Do not start a second task before the first reaches `DONE` or `BLOCKED` and is recorded as such.

## 4. Working rules

- **One task at a time.** Take the highest-priority task from `internal/PROGRESS.md` that is not `DONE` or `BLOCKED`. Don't start a second task before the first stops.
- **Do not expand scope.** If you find another problem while working, log it as a new row in `internal/PROGRESS.md` — do not fix it in the same task.
- **Do not delete or move files unless the task explicitly says so.**
- **Never mark a task `DONE` without evidence.** "Evidence" means: the actual command output of typecheck, lint, test, and build passing (paste or summarize real output, don't assert it), plus a manual check where the task touches behavior a test can't easily cover (e.g., actually hitting an API route, loading a page).
- **Never add a public claim (README, docs/, package descriptions) for a feature that isn't implemented and tested.** If you're tempted to write "supports X," first confirm X has passing tests and works end to end, or write "planned" instead.
- **Never put secrets, tokens, or `.env` values in any file or in your own output** (chat, logs, commit-message suggestions). If you must refer to one, write `[REDACTED]`.
- **Never commit `.env`, secrets, `internal/`, or AI tooling configs** (`.claude/`, `.codex/`, `.mcp.json`, `.reticle.json`) — moot under the no-commit policy in §2, but applies if that policy ever changes. See `internal/FILE_CLASSIFICATION.md` for what's already (wrongly) tracked — don't make it worse.
- **Never describe a security vulnerability in any public file** — README, `docs/`, code comments, or a commit-message suggestion you give the owner. Reference it only by its internal tracking ID (e.g. "fixes P0-1"). Full detail belongs in `internal/` only — and even there, check first: `internal/` has been found tracked by git and pushed to the remote before (see `internal/FILE_CLASSIFICATION.md`), which means it was effectively public. Verify its current tracked status (`git ls-files internal/`) before assuming detail written there is actually private. **`AUDIT_REPORT.md` at the repo root is a known, currently-live example of this** — it contains full vulnerability detail and is tracked and pushed to the remote right now (confirmed 2026-10-04, `git ls-files AUDIT_REPORT.md`). Flag it, don't assume someone already fixed it.
- **Ask the user before:** rewriting git history, deleting any existing file, or changing a public API (exported function signatures, package.json `exports`/`bin`, REST route contracts). (Publishing to npm and version bumps are already covered by §2.)

## 5. Quality gate

Run these exact commands (from the root `package.json`) before considering any task's code changes complete:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If the task touches a specific package under `packages/*`, also run that package's own `typecheck`/`test`/`build` scripts (e.g. `npm run build --workspace packages/core`), since `packages/core`/`packages/next` are a separately maintained source tree from the root `orycms/` — see `docs/PROJECT_STRUCTURE.md` "How the packages relate." A fix in `orycms/` does not automatically apply there.

## 6. End-of-task routine (mandatory)

Before ending work on a task:
1. Update `internal/PROGRESS.md`:
   - Set the task's `Status` (TODO / IN_PROGRESS / BLOCKED / DONE) and `Branch` columns (the branch is a *suggested* name per §2 — nothing was actually created).
   - Add a dated entry at the top of the **Log** section: what changed, which files were touched, the verification evidence (quality-gate output summary), and any follow-ups or new issues discovered.
2. If you discovered a new problem, or the task turned out to be different/bigger/smaller than scoped, **edit the task table** — add a new row, re-prioritize, or split the task. The task list must always reflect reality, not the plan as originally written. Do not fix the new problem now — see §4.
3. If the change affected the repo's structure (new top-level folder, new package, changed relationship between `orycms/` and `packages/*`, new request-flow step), update `docs/PROJECT_STRUCTURE.md` to match.
4. **Stop and report.** Give the owner: the list of changed files, a suggested branch name, and a suggested commit message (per §2). Do not start the next task in the same session.

## 7. Definition of Done checklist

A task is only `DONE` when **all** of the following are true:
- [ ] No git write command was run — everything is sitting uncommitted in the working tree (see §2).
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass — actual output checked, not assumed.
- [ ] If the fix is shared logic, it was applied (or explicitly and consciously skipped, with a note why) in both `orycms/` and the matching `packages/core`/`packages/next` location.
- [ ] No new public claim was added for anything not implemented and tested.
- [ ] No secret, token, `.env` value, `internal/` content, or AI tooling config appears in any file or in your own output.
- [ ] `internal/PROGRESS.md` task row and Log section updated.
- [ ] `docs/PROJECT_STRUCTURE.md` updated if structure changed.
- [ ] For security fixes: vulnerability detail kept out of README/docs/code comments/commit-message suggestions.
- [ ] Final report to the owner includes: changed files, suggested branch name, suggested commit message.
