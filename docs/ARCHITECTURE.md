# OryCMS Architecture

> Foundational architecture reference for OryCMS — a headless CMS and commerce platform by OrynticLabs Private Limited.

---

## Overview

OryCMS is a unified admin platform combining:
- **Headless CMS** — schema-driven content management with a Collections + Content model
- **Commerce** — products, orders, inventory, and customer management
- **Identity** — role-based access control (RBAC) for all admin users
- **Platform** — plugin extensibility, database introspection, and SEO tooling

Built on **Next.js 15 App Router**, **TypeScript**, **Tailwind CSS v4**, and **Radix UI** (shadcn/ui).

---

## Repository Structure

```
OryCMS/
├── docs/
│   ├── ARCHITECTURE.md
│   └── NAMING_CONVENTIONS.md
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                         → Dashboard (/)
│   │   ├── login/
│   │   ├── not-found.tsx
│   │   │
│   │   ├── collections/
│   │   │   ├── page.tsx                     → Collection list
│   │   │   └── [collection]/
│   │   │       ├── page.tsx                 → Schema editor
│   │   │       └── content/
│   │   │           ├── page.tsx             → Entry list
│   │   │           ├── new/page.tsx         → Create entry
│   │   │           └── [id]/page.tsx        → Edit entry
│   │   │
│   │   ├── content/page.tsx
│   │   ├── media/page.tsx
│   │   ├── users/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── invite/page.tsx
│   │   ├── roles/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── plugins/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── database/
│   │   │   ├── page.tsx
│   │   │   └── migrations/page.tsx
│   │   ├── seo/
│   │   │   ├── page.tsx
│   │   │   ├── redirects/page.tsx
│   │   │   └── sitemap/page.tsx
│   │   │
│   │   ├── products/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── marketing/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── settings/page.tsx
│   │   │
│   │   └── api/
│   │       └── orycms/                      ← OryCMS API namespace
│   │           ├── auth/                    → login, logout, me, refresh
│   │           ├── collections/
│   │           │   ├── route.ts
│   │           │   └── [collection]/
│   │           │       ├── route.ts
│   │           │       ├── fields/
│   │           │       │   ├── route.ts
│   │           │       │   └── [id]/route.ts
│   │           │       └── content/
│   │           │           ├── route.ts
│   │           │           └── [id]/
│   │           │               ├── route.ts
│   │           │               └── publish/route.ts
│   │           ├── media/
│   │           │   ├── route.ts
│   │           │   ├── [id]/route.ts
│   │           │   └── folders/route.ts
│   │           ├── users/
│   │           │   ├── route.ts
│   │           │   └── [id]/route.ts
│   │           ├── roles/
│   │           │   ├── route.ts
│   │           │   └── [id]/
│   │           │       ├── route.ts
│   │           │       └── permissions/route.ts
│   │           ├── plugins/
│   │           │   ├── route.ts
│   │           │   └── [slug]/route.ts
│   │           ├── database/
│   │           │   ├── migrations/route.ts
│   │           │   └── schemas/route.ts
│   │           ├── seo/
│   │           │   ├── redirects/
│   │           │   │   ├── route.ts
│   │           │   │   └── [id]/route.ts
│   │           │   └── sitemap/route.ts
│   │           ├── settings/
│   │           │   ├── route.ts
│   │           │   └── api-keys/
│   │           │       ├── route.ts
│   │           │       └── [id]/route.ts
│   │           ├── products/route.ts
│   │           ├── orders/route.ts
│   │           └── customers/route.ts
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── AppShell.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   ├── InsightsPanel.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   └── PlaceholderPage.tsx
│   │   └── ui/                              ← shadcn/ui primitives
│   │
│   ├── hooks/
│   │   └── use-mobile.tsx
│   │
│   ├── lib/
│   │   └── utils.ts                         → cn(), formatCurrency()
│   │
│   ├── services/                            ← Service layer
│   │   ├── index.ts
│   │   ├── auth.service.ts                  → OryCMSAuthService
│   │   ├── collections.service.ts           → OryCMSCollectionService
│   │   ├── content.service.ts               → OryCMSContentService
│   │   ├── media.service.ts                 → OryCMSMediaService
│   │   ├── users.service.ts                 → OryCMSUserService
│   │   ├── roles.service.ts                 → OryCMSRoleService
│   │   ├── plugins.service.ts               → OryCMSPluginService
│   │   ├── database.service.ts              → OryCMSDatabaseService
│   │   ├── seo.service.ts                   → OryCMSSeoService
│   │   └── settings.service.ts              → OryCMSSettingsService
│   │
│   ├── types/                               ← TypeScript contracts
│   │   ├── index.ts
│   │   ├── common.types.ts                  → OryCMSID, OryCMSTimestamps, ...
│   │   ├── api.types.ts                     → OryCMSApiResponse, ...
│   │   ├── collection.types.ts              → OryCMSCollection, OryCMSField, ...
│   │   ├── content.types.ts                 → OryCMSContentEntry, ...
│   │   ├── media.types.ts                   → OryCMSMediaAsset, ...
│   │   ├── user.types.ts                    → OryCMSUser, OryCMSSessionUser, ...
│   │   ├── role.types.ts                    → OryCMSRole, OryCMSPermission, ...
│   │   ├── plugin.types.ts                  → OryCMSPlugin, ...
│   │   ├── database.types.ts                → OryCMSDatabaseTable, OryCMSMigration, ...
│   │   ├── seo.types.ts                     → OryCMSSeoPage, OryCMSRedirect, ...
│   │   └── settings.types.ts                → OryCMSWorkspaceSettings, ...
│   │
│   └── styles.css
```

---

## Architectural Layers

```
┌───────────────────────────────────────────────────────────┐
│                    Next.js App Router                      │
│         src/app/**/(page|layout|route).tsx                 │
├───────────────────────────────────────────────────────────┤
│                   React Components                         │
│         src/components/dashboard/ + ui/                    │
├───────────────────────────────────────────────────────────┤
│                   Service Layer                            │
│        OryCMS*Service  ·  src/services/                   │
├───────────────────────────────────────────────────────────┤
│                  Type Definitions                          │
│        OryCMS*  ·  src/types/                             │
├───────────────────────────────────────────────────────────┤
│           Database / External APIs  (Phase 2+)             │
└───────────────────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| **Pages** (`src/app/`) | Route handling, data fetching (RSC), pass data to components |
| **Components** (`src/components/`) | UI rendering only — no direct database or service access |
| **Services** (`src/services/`) | All business logic, data transformation, external integrations |
| **Types** (`src/types/`) | Shared `OryCMS*` TypeScript contracts — imported by all layers |
| **API Routes** (`src/app/api/orycms/`) | HTTP parsing, auth check, delegate to service |

**Rule:** pages call services; components receive props; API routes validate then call services.

---

## Naming Contract

Every exported identifier follows the `OryCMS` prefix rule. See [NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md) for the full spec.

| Category | Pattern | Examples |
|---|---|---|
| Types / interfaces | `OryCMS` + PascalCase | `OryCMSCollection`, `OryCMSContentEntry`, `OryCMSApiResponse<T>` |
| Service objects | `OryCMS` + Domain + `Service` | `OryCMSCollectionService`, `OryCMSDatabaseService` |
| Standalone functions | `verb` + `OryCMS` + Resource | `getOryCMSCollections`, `createOryCMSCollection` |
| React components | PascalCase (no prefix) | `AppShell`, `PlaceholderPage` |
| Route handlers | Next.js exports (no prefix) | `GET`, `POST`, `PATCH`, `DELETE` |

---

## Navigation Architecture

Sidebar groups (7):

| Group | Routes |
|---|---|
| **Workspace** | Overview (`/`) |
| **Commerce** | Products, Categories, Inventory, Orders, Customers |
| **Content** | Collections, Content, Media |
| **Identity** | Users, Roles |
| **Growth** | Marketing, Analytics |
| **Platform** | Plugins, Database, SEO |
| **System** | Settings |

`AppShell` renders: `AppSidebar` + `Topbar` + `main` (scrollable, flex column, footer pinned) + `InsightsPanel` (slide-in via icon toggle).

---

## API Design

### Namespace

All OryCMS REST endpoints: `/api/orycms/{resource}`.

The `orycms` namespace replaces generic `/api/v1/`. Per-resource versioning can be added internally (e.g., a new handler file) without changing the public URL.

### Patterns

```
Collection:  GET  /api/orycms/{resource}                → paginated list
             POST /api/orycms/{resource}                → create
Single:      GET  /api/orycms/{resource}/:id            → read one
             PATCH /api/orycms/{resource}/:id           → update
             DELETE /api/orycms/{resource}/:id          → remove
Action:      POST /api/orycms/{resource}/:id/publish    → trigger
Sub-resource: GET /api/orycms/collections/:collection/fields → nested
```

### Dynamic parameters

| Segment | Meaning |
|---|---|
| `:collection` | Collection slug (e.g., `blog-posts`) |
| `:slug` | Plugin or general-purpose slug |
| `:id` | Primary key / UUID for any resource or sub-resource |

### Response envelope (typed as `OryCMSApiResponse<T>`)

```json
{ "success": true, "data": { ... }, "meta": { ... } }
{ "success": false, "error": { "code": "...", "message": "..." } }
```

---

## Content Architecture

### Collections (`OryCMSCollection`)
Defines the structure of a content type: `slug`, `fields[]` (typed `OryCMSField`), and `settings` (`OryCMSCollectionSettings`).

### Content (`OryCMSContentEntry`)
An instance of a collection with `data` matching the schema, `status` (`draft | published | archived`), and `locale`.

### Media (`OryCMSMediaAsset`)
Uploaded files with auto-generated format variants (`OryCMSMediaFormats`), organized into `OryCMSMediaFolder` trees.

---

## Identity and Access Control

### Roles (`OryCMSRole`)
Holds `OryCMSPermission[]` — each with `action` (create / read / update / delete / publish / manage) and `subject` (collection / content / media / user / role / ...).

### Users (`OryCMSUser`)
Carries an array of role IDs. Permissions computed at runtime by merging assigned roles. System roles (`isSystem: true`) are non-deletable.

---

## Technology Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 with CSS custom properties |
| UI primitives | Radix UI + shadcn/ui |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Icons | Lucide React |
| Currency | `Intl.NumberFormat` (INR) via `formatCurrency()` |

---

## Phase Roadmap

| Phase | Focus |
|---|---|
| **v1 (current)** | Foundational architecture — types, services, routes, sidebar, placeholder pages, docs |
| **v2** | Authentication, database layer (Postgres + ORM), collection CRUD |
| **v3** | Content entry builder, media uploads, rich text editor |
| **v4** | Users, roles, permission enforcement middleware |
| **v5** | Plugin engine, SEO tooling, sitemap generation |
| **v6** | Commerce CRUD (products, orders, customers) |
| **v7** | Analytics, marketing, AI Copilot |
