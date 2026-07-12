# Changelog

All notable changes to `@ory-cms/cli` will be documented in this file.

## [0.1.0] - 2026-07-12

### Added

- `orycms init` — interactive wizard to scaffold OryCMS into an existing Next.js App Router project
- `orycms plugin install/uninstall/update/list/enable/disable` — plugin lifecycle management
- `orycms config show/init` — view and regenerate OryCMS configuration
- Database setup wizard supporting PostgreSQL, Neon, Supabase, MySQL, MariaDB, MongoDB, SQLite, and Firebase
- Auto-detection of Next.js version, App Router presence, and package manager
- File generators for `orycms.config.ts`, admin catch-all route, `.env.example`, `tsconfig.json` path alias, and `package.json` dependency injection
