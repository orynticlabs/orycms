# Changelog

All notable changes to `create-ory-cms` will be documented in this file.

## [0.1.2] - 2026-07-16

### Fixed

- **Critical:** `npx create-ory-cms` crashed with `ERR_MODULE_NOT_FOUND`. The published binary was built with `tsc`, which leaves relative imports extensionless — Node's ESM loader rejects those. Switched the build to `tsup`, which bundles into a single self-contained `dist/index.js`.
- Corrected `bin`, `main`, and `exports` to point at the new flat `dist/index.js`.

### Added

- Binary smoke test that loads the compiled `dist/index.js` through Node's ESM loader.

## [0.1.0] - 2026-07-12

### Added

- Interactive scaffolding wizard for adding OryCMS to new or existing Next.js projects
- Supports App Router and Pages Router
- Database setup with connection testing for PostgreSQL, Neon, Supabase, MySQL, MariaDB, MongoDB, SQLite, and Firebase
- Generates `orycms.config.ts`, admin route handler, `.env.example`, and updates `tsconfig.json` and `package.json`
- `--cwd` option to target a specific directory
- `--skip-db` flag to bypass database operations in CI / offline environments
- Auto-detection of Next.js version, router type, and package manager
