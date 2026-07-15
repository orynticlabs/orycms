# Changelog

All notable changes to `@ory-cms/cli` will be documented in this file.

## [0.1.2] - 2026-07-16

### Fixed

- **Critical:** `npx @ory-cms/cli init` crashed with `ERR_MODULE_NOT_FOUND`. The published binary was built with `tsc`, which leaves relative imports extensionless — Node's ESM loader rejects those. Switched the build to `tsup`, which bundles into a single self-contained `dist/index.js` with all imports resolved.
- Corrected `bin`, `main`, and `exports` to point at the new flat `dist/index.js` (was `dist/packages/cli/src/index.js`).

### Added

- Binary smoke test that loads the compiled `dist/index.js` through Node's ESM loader — guards against this regression.

## [0.1.0] - 2026-07-12

### Added

- `orycms init` — interactive wizard to scaffold OryCMS into an existing Next.js App Router project
- `orycms plugin install/uninstall/update/list/enable/disable` — plugin lifecycle management
- `orycms config show/init` — view and regenerate OryCMS configuration
- Database setup wizard supporting PostgreSQL, Neon, Supabase, MySQL, MariaDB, MongoDB, SQLite, and Firebase
- Auto-detection of Next.js version, App Router presence, and package manager
- File generators for `orycms.config.ts`, admin catch-all route, `.env.example`, `tsconfig.json` path alias, and `package.json` dependency injection
