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

OryCMS is a self-hosted CMS that runs embedded inside a Next.js App Router app, plus four npm packages (`@ory-cms/core`, `@ory-cms/next`, `@ory-cms/cli`, `create-ory-cms`) that republish the same functionality for external consumers. Authentication, sessions, RBAC, lifecycle hooks, draft/publish states, Postgres migrations, and email are real, working, and tested.

**Honest current status — do not contradict this in any public-facing edit:** Postgres is the only working database adapter. MySQL/MongoDB/Firebase/Oracle adapters, S3 storage, plugin-contributed routes, and most of the admin dashboard (analytics, customers, orders, products, inventory, marketing, SEO, categories) are not implemented, or are placeholder/mock UI. Both documented onboarding commands (`npx create-ory-cms my-app`, `npx @ory-cms/cli db:migrate`) are broken as written in the README. There is at least one open, unpatched security issue. **See `internal/PROGRESS.md` for the full, maintained task list and current status of every feature — treat it as more current than this summary.**

## 2. Mandatory start-of-session routine

Before doing anything else, in this order:
1. Read this file (`AGENTS.md`) in full.
2. Read `docs/PROJECT_STRUCTURE.md`.
3. Read `internal/PROGRESS.md`.
4. Pick the highest-priority task in `internal/PROGRESS.md`'s task table that is not `DONE` and not `BLOCKED`. Work P0 before P1 before P2 before P3, top to bottom within a priority tier, unless the user tells you otherwise.
5. Work on **one task at a time**. Do not start a second task before the first reaches `DONE` or `BLOCKED` and is recorded as such.

## 3. Working rules

- **Branch per task.** Create `fix/...`, `feat/...`, or `docs/...` named after the task. Never commit directly to `main`.
- **Never mark a task `DONE` without evidence.** "Evidence" means: the actual command output of typecheck, lint, test, and build passing (paste or summarize real output, don't assert it), plus a manual check where the task touches behavior a test can't easily cover (e.g., actually hitting an API route, loading a page).
- **Never add a public claim (README, docs/, package descriptions) for a feature that isn't implemented and tested.** If you're tempted to write "supports X," first confirm X has passing tests and works end to end, or write "planned" instead.
- **Never commit `.env`, secrets, `internal/`, or AI tooling configs** (`.claude/`, `.codex/`, `.mcp.json`, `.reticle.json`). See `internal/FILE_CLASSIFICATION.md` for what's already (wrongly) tracked — don't make it worse, and don't assume something is fine to commit just because a similar file is already tracked.
- **Security-sensitive fixes:** do not describe the vulnerability (what it is, where it is, how to trigger it) in commit messages, PR descriptions, or public issues before a patched version is released. Reference it only by its internal tracking ID (e.g. "fixes P0-1") in public-facing text.
- **Ask the user before:** publishing to npm, rewriting git history, deleting any existing file, or changing a public API (exported function signatures, package.json `exports`/`bin`, REST route contracts).

## 4. Quality gate

Run these exact commands (from the root `package.json`) before considering any task's code changes complete:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If the task touches a specific package under `packages/*`, also run that package's own `typecheck`/`test`/`build` scripts (e.g. `npm run build --workspace packages/core`), since `packages/core`/`packages/next` are a separately maintained source tree from the root `orycms/` — see `docs/PROJECT_STRUCTURE.md` "How the packages relate." A fix in `orycms/` does not automatically apply there.

## 5. End-of-task routine (mandatory)

Before ending work on a task:
1. Update `internal/PROGRESS.md`:
   - Set the task's `Status` (TODO / IN_PROGRESS / BLOCKED / DONE) and `Branch` columns.
   - Add a dated entry at the top of the **Log** section: what changed, which files were touched, the verification evidence (quality-gate output summary), and any follow-ups or new issues discovered.
2. If you discovered a new problem, or the task turned out to be different/bigger/smaller than scoped, **edit the task table** — add a new row, re-prioritize, or split the task. The task list must always reflect reality, not the plan as originally written.
3. If the change affected the repo's structure (new top-level folder, new package, changed relationship between `orycms/` and `packages/*`, new request-flow step), update `docs/PROJECT_STRUCTURE.md` to match.

## 6. Definition of Done checklist

A task is only `DONE` when **all** of the following are true:
- [ ] Code changes committed on a dedicated branch (not `main`).
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass — actual output checked, not assumed.
- [ ] If the fix is shared logic, it was applied (or explicitly and consciously skipped, with a note why) in both `orycms/` and the matching `packages/core`/`packages/next` location.
- [ ] No new public claim was added for anything not implemented and tested.
- [ ] No secret, `.env`, `internal/` file, or AI tooling config was committed.
- [ ] `internal/PROGRESS.md` task row and Log section updated.
- [ ] `docs/PROJECT_STRUCTURE.md` updated if structure changed.
- [ ] For security fixes: vulnerability detail kept out of commit messages/public issues.
