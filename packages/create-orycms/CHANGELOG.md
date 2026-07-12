# Changelog

All notable changes to `create-orycms` will be documented in this file.

## [0.1.0] - 2026-07-12

### Added

- Interactive scaffolding wizard for adding OryCMS to new or existing Next.js projects
- Supports App Router and Pages Router
- Database setup with connection testing for PostgreSQL, Neon, Supabase, MySQL, MariaDB, MongoDB, SQLite, and Firebase
- Generates `orycms.config.ts`, admin route handler, `.env.example`, and updates `tsconfig.json` and `package.json`
- `--cwd` option to target a specific directory
- `--skip-db` flag to bypass database operations in CI / offline environments
- Auto-detection of Next.js version, router type, and package manager
