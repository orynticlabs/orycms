# OryCMS Naming Conventions

> Single source of truth for file names, variable names, route segments, API paths, and TypeScript identifiers across the OryCMS codebase.

---

## 1. File and Folder Names

| Context | Convention | Example |
|---|---|---|
| React components | `PascalCase.tsx` | `AppSidebar.tsx` |
| Next.js pages | `page.tsx` | `src/app/collections/page.tsx` |
| Next.js layouts | `layout.tsx` | `src/app/layout.tsx` |
| Next.js API routes | `route.ts` | `src/app/api/orycms/users/route.ts` |
| TypeScript types | `kebab-case.types.ts` | `collection.types.ts` |
| Services | `kebab-case.service.ts` | `collections.service.ts` |
| Hooks | `use-kebab-case.ts(x)` | `use-mobile.tsx` |
| Utilities / lib | `kebab-case.ts` | `utils.ts` |
| Folders (src) | `kebab-case` | `src/services/` |
| Dynamic segments | `[camelCase]` | `[collection]`, `[slug]`, `[id]` |

---

## 2. OryCMS Identifier Prefix Rule

**All public exports** — types, interfaces, service objects, hooks, stores, providers, utilities — must carry the `OryCMS` prefix. This applies to every identifier that is exported from a module and consumed outside it.

**Exceptions (no prefix required):**
- Generic local callback names inside components: `handleSubmit`, `handleClick`, `onChange`
- Internal implementation details not exported: local variables, helper functions within a file
- React component names: `AppShell`, `AppSidebar`, `PlaceholderPage` (these follow PascalCase component naming)
- Standard Next.js file exports: `default function Page()`, `export async function GET()`

### Types and interfaces
```ts
// ✅ Correct — OryCMS prefix, PascalCase
export interface OryCMSCollection { ... }
export type OryCMSContentStatus = "draft" | "published" | "archived";
export interface OryCMSPaginatedResponse<T> { ... }

// ❌ Wrong — no prefix
export interface Collection { ... }
export type ContentStatus = "draft" | "published";
```

### Service objects
```ts
// ✅ Correct — PascalCase singleton, OryCMS prefix
export const OryCMSCollectionService = { ... };
export const OryCMSDatabaseService = { ... };

// ❌ Wrong
export const collectionsService = { ... };
```

### Standalone utility functions
```ts
// ✅ Correct
export function getOryCMSCollections(...) { ... }
export function createOryCMSCollection(...) { ... }
export function validateOryCMSCollection(...) { ... }

// ❌ Wrong
export function getCollections(...) { ... }
```

---

## 3. TypeScript Identifiers

### Variables and local functions
```ts
// camelCase for all local variables and internal functions
const collectionSlug = "blog-posts";
function buildWhereClause(filter: OryCMSFilterParams) { ... }
```

### React components
```ts
// PascalCase — no OryCMS prefix on component names (they are identified by their folder)
export function AppSidebar({ collapsed }: Props) { ... }
export function PlaceholderPage({ title }: Props) { ... }
```

### Enums
```ts
// PascalCase with OryCMS prefix for name; string literal unions preferred over enums
type OryCMSMigrationStatus = "pending" | "applied" | "failed";
```

### Module-level constants
```ts
// SCREAMING_SNAKE_CASE for compile-time constants inside a module (no prefix needed)
const APP_VERSION = "v1.0.0";
const DEFAULT_LOCALE = "en-IN";
```

---

## 4. Dynamic Route Parameter Names

| Segment | Used for | Example path |
|---|---|---|
| `[collection]` | Collection slug identifier | `/collections/[collection]` |
| `[slug]` | General-purpose slug (plugins, etc.) | `/plugins/[slug]` |
| `[id]` | Primary key / UUID for any resource | `/users/[id]`, `/roles/[id]`, `/fields/[id]` |

**Rule:** Never use `[fieldId]`, `[collectionSlug]`, `[pluginId]`, etc. — always reduce to `[collection]`, `[slug]`, or `[id]`.

---

## 5. Admin Page Routes

```
/                                        → Dashboard overview
/collections                             → Collection schema list
/collections/[collection]                → Single collection schema editor
/collections/[collection]/content        → Content entries for collection
/collections/[collection]/content/new    → New content entry
/collections/[collection]/content/[id]   → Edit content entry
/content                                 → Cross-collection content browser
/media                                   → Media library
/users                                   → User list
/users/[id]                              → User detail
/users/invite                            → Invite user flow
/roles                                   → Roles list
/roles/[id]                              → Role + permission editor
/roles/new                               → Create role
/plugins                                 → Plugin marketplace
/plugins/[slug]                          → Plugin detail
/database                                → Database browser
/database/migrations                     → Migration history
/seo                                     → SEO overview
/seo/redirects                           → Redirect rules
/seo/sitemap                             → Sitemap settings
/products                                → Product catalog
/categories                              → Category tree
/inventory                               → Stock management
/orders                                  → Order queue
/customers                               → Customer directory
/marketing                               → Campaigns & coupons
/analytics                               → Analytics dashboard
/settings                                → Workspace settings
/login                                   → Auth page
```

---

## 6. API Route Paths

All OryCMS REST endpoints are prefixed with `/api/orycms/`. The `orycms` namespace:
- Identifies OryCMS routes unambiguously in the Next.js app
- Allows per-resource versioning internally without exposing `/api/v1/` externally
- Avoids conflicts with custom application routes

```
/api/orycms/auth/login
/api/orycms/auth/logout
/api/orycms/auth/me
/api/orycms/auth/refresh

/api/orycms/collections
/api/orycms/collections/:collection
/api/orycms/collections/:collection/fields
/api/orycms/collections/:collection/fields/:id
/api/orycms/collections/:collection/content
/api/orycms/collections/:collection/content/:id
/api/orycms/collections/:collection/content/:id/publish

/api/orycms/media
/api/orycms/media/:id
/api/orycms/media/folders

/api/orycms/users
/api/orycms/users/:id

/api/orycms/roles
/api/orycms/roles/:id
/api/orycms/roles/:id/permissions

/api/orycms/plugins
/api/orycms/plugins/:slug

/api/orycms/database/migrations
/api/orycms/database/schemas

/api/orycms/seo/redirects
/api/orycms/seo/redirects/:id
/api/orycms/seo/sitemap

/api/orycms/settings
/api/orycms/settings/api-keys
/api/orycms/settings/api-keys/:id

/api/orycms/products
/api/orycms/orders
/api/orycms/customers
```

### HTTP verb semantics

| Verb | Use |
|---|---|
| `GET` | Read one or many |
| `POST` | Create a resource, or trigger an action (publish, install) |
| `PATCH` | Partial update |
| `PUT` | Full replacement (permission matrix) |
| `DELETE` | Remove a resource |

---

## 7. API Request / Response Shape

### Success
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "hasMore": true }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { "email": ["Email is required"] }
  }
}
```

Typed as `OryCMSApiResponse<T>` = `OryCMSApiSuccessResponse<T> | OryCMSApiErrorResponse`.

### Error codes
| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Input failed validation |
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Session lacks permission |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Unique constraint violation |
| `NOT_IMPLEMENTED` | 501 | Stub — not yet built |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 8. CSS / Tailwind

- Use **utility classes** directly; avoid custom class names unless reused ≥3 times.
- Design tokens come from CSS custom properties via `@theme inline` in `styles.css`.
- Use `cn()` from `@/lib/utils` for conditional class composition.
- Pixel-precise font sizes use bracket notation: `text-[13px]`, `text-[26px]`.

---

## 9. Component Props

- Props interfaces use `PascalCase` matching the component name.
- Boolean props omit `is`/`has` prefix only when unambiguous: `collapsed`, `open`.
- Event handlers use `on` prefix: `onToggle`, `onChange`, `onInsightsToggle`.
- Render prop / children slots: `children: React.ReactNode`.

---

## 10. Git and Branch Names

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/short-description` | `feat/collection-schema-editor` |
| Fix | `fix/short-description` | `fix/sidebar-active-state` |
| Chore | `chore/short-description` | `chore/update-dependencies` |
| Docs | `docs/short-description` | `docs/naming-conventions-v2` |

Commit messages follow Conventional Commits: `type(scope): message`.

---

## 11. Service Layer Conventions

- Service files export a **single PascalCase OryCMS-prefixed object**: `OryCMSCollectionService`.
- Every method is `async` and returns a typed Promise using `OryCMS*` types.
- Stub methods throw `new Error("Not implemented")` until implemented.
- Input parameters are prefixed with `_` in stubs to suppress lint warnings.
- Services import types from `@/types` only — never from other services.
- The barrel `src/services/index.ts` re-exports every service by name.

---

## 12. Import Order

1. `react` / `next` built-ins
2. Third-party packages (alphabetical)
3. Internal aliases (`@/components/...`, `@/lib/...`, `@/types/...`, `@/services/...`)
4. Relative imports (`./`, `../`)
5. Type-only imports last with `import type`
