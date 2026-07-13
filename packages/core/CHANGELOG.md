# Changelog

All notable changes to `@ory-cms/core` will be documented in this file.

## [0.1.0] — 2026-07-13

### Added

- Initial release — extracted from the OryCMS monorepo
- Schema engine: `defineOryCMSCollection`, `registerOryCMSCollection`, `validateOryCMSCollectionSchema`
- Auth: `loginOryCMSUser`, `logoutOryCMSUser`, `protectOryCMSAdminRoute`, `validateOryCMSSession`
- RBAC: `hasOryCMSPermission`, `requireOryCMSPermission`, built-in role matrix
- Hooks: before/after lifecycle events on all content, media, auth, and migration operations
- Database adapters: PostgreSQL, MySQL, MongoDB, Firebase, Oracle
- Plugin engine: discovery, manifest validation, dependency resolution, registry
- Services: auth, collections, content, media, users, roles, plugins, database, SEO, settings
- Config: `defineOryCMSConfig`, `validateOryCMSConfig`
- Migrations: idempotent core schema installer
