<div align="center">

# OryCMS

### The open-source CMS and application framework for Next.js

Define your content in TypeScript and get a production-ready admin dashboard, REST API, authentication, and role-based access control — running inside your own Next.js app, on your own infrastructure.

[![npm core](https://img.shields.io/npm/v/@ory-cms/core?label=%40ory-cms%2Fcore)](https://www.npmjs.com/package/@ory-cms/core)
[![npm next](https://img.shields.io/npm/v/@ory-cms/next?label=%40ory-cms%2Fnext)](https://www.npmjs.com/package/@ory-cms/next)
[![npm cli](https://img.shields.io/npm/v/@ory-cms/cli?label=%40ory-cms%2Fcli)](https://www.npmjs.com/package/@ory-cms/cli)
[![license](https://img.shields.io/npm/l/@ory-cms/core)](./LICENSE)

Built by **OrynticLabs Private Limited**

[Documentation](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/) · [npm](https://www.npmjs.com/org/ory-cms) · [Issues](https://github.com/orynticlabs/orycms/issues)

</div>

---

## What is OryCMS?

OryCMS is a self-hosted content management system that installs as a set of npm packages directly into your Next.js project. There is no separate service to run and no vendor to sign up for — the CMS lives in your codebase alongside the rest of your application.

You describe your content as **collections** in plain TypeScript. From that single definition, OryCMS builds the admin screens, the database table, and the REST API automatically.

---

## Quick start

Create a new project in one command:

```bash
npx create-ory-cms my-app
cd my-app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create your Owner account. That's it.

> New to OryCMS? The **[Quick Start guide](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/quick-start)** walks through every step.

---

## Add to an existing Next.js app

Already have a Next.js project? Add OryCMS without touching your existing routes:

```bash
# 1. Install the two runtime packages
npm install @ory-cms/core @ory-cms/next

# 2. Run the setup wizard (generates config + admin routes)
npx @ory-cms/cli init

# 3. Create the OryCMS database tables
npx @ory-cms/cli db:migrate

# 4. Start your app — the dashboard is now at /admin
npm run dev
```

Your existing pages, API routes, and database tables are left completely alone. OryCMS only occupies `/admin`, `/collections`, `/plugins`, and `/api/orycms/`, and its tables are all prefixed `orycms_`.

Full walkthrough: **[Add to an Existing Project](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/add-to-existing-project)**.

---

## Packages

| Package | Version | Description |
|---|---|---|
| [`@ory-cms/core`](https://www.npmjs.com/package/@ory-cms/core) | ![](https://img.shields.io/npm/v/@ory-cms/core) | The engine — schema, auth, roles, hooks, database adapters (server-side) |
| [`@ory-cms/next`](https://www.npmjs.com/package/@ory-cms/next) | ![](https://img.shields.io/npm/v/@ory-cms/next) | The Next.js layer — admin dashboard UI and React components |
| [`@ory-cms/cli`](https://www.npmjs.com/package/@ory-cms/cli) | ![](https://img.shields.io/npm/v/@ory-cms/cli) | CLI — `init`, `db:migrate`, `db:seed`, plugin management |
| [`create-ory-cms`](https://www.npmjs.com/package/create-ory-cms) | ![](https://img.shields.io/npm/v/create-ory-cms) | Scaffolder — `npx create-ory-cms my-app` |
| `@ory-cms/react` | _coming soon_ | Headless React hooks for consuming content in a frontend |
| `@ory-cms/plugin-sdk` | _coming soon_ | Typed helpers and testing utilities for plugin authors |

**The rule of thumb:** `core` is the brain, `next` is the face, and the two CLIs are the tools that wire everything together. See the **[Packages guide](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/packages)** for details.

---

## Define your first collection

A collection is a content type. Define it once and OryCMS handles the rest:

```ts
// orycms.config.ts
import { defineOryCMSConfig, defineOryCMSCollection } from "@ory-cms/core";

const Posts = defineOryCMSCollection({
  name: "Posts",
  slug: "posts",
  tableName: "posts",
  fields: [
    { name: "title",       type: "text",     required: true },
    { name: "slug",        type: "slug",     required: true, unique: true },
    { name: "body",        type: "richText" },
    { name: "coverImage",  type: "media" },
    { name: "publishedAt", type: "date",     includeTime: true },
  ],
});

export default defineOryCMSConfig({
  collections: [Posts],
});
```

You now have an admin screen for posts at `/admin`, and a REST API:

```
GET    /api/orycms/collections/posts/content        # list published posts (public)
POST   /api/orycms/collections/posts/content        # create a post (auth required)
PATCH  /api/orycms/collections/posts/content/:id    # update a post
DELETE /api/orycms/collections/posts/content/:id    # delete a post
```

---

## Features

**Content**
- Schema-driven collections with 13 field types (text, rich text, media, relation, select, and more)
- Draft and published states, per-entry
- A media library for images and files

**Access control**
- Email + password authentication with secure HTTP-only session cookies (bcrypt hashing)
- Five built-in roles — Owner, Admin, Editor, Author, Viewer
- Fine-grained, per-resource permissions

**Extensibility**
- A plugin system for adding features without editing the core
- Lifecycle hooks that run your code before or after any content, media, or auth operation

**Database**
- Adapters for PostgreSQL, MySQL, MongoDB, Firebase, and Oracle
- Idempotent migrations you can run safely, repeatedly

---

## Tech stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** with **Radix UI** / shadcn/ui components
- **PostgreSQL** (recommended) and other adapters
- **bcrypt** password hashing, cookie-based sessions

---

## Requirements

- Node.js 18 or newer
- A database — PostgreSQL is the smoothest choice ([Neon](https://neon.tech) and [Supabase](https://supabase.com) offer free hosted instances)

---

## Environment variables

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
NEXTAUTH_SECRET=a-long-random-string        # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Optional — object storage
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=

# Optional — email
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASSWORD=
```

---

## Documentation

The full documentation lives on GitBook:

- **[Quick Start](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/quick-start)** — a new project in five minutes
- **[Add to an Existing Project](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/add-to-existing-project)** — drop OryCMS into an app you already have
- **[Packages](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/packages)** — what each package does
- **[Collections & Fields](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/collections-and-fields)** — modelling your content
- **[Authentication](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/authentication)** and **[Roles & Permissions](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/roles-and-permissions)**
- **[API Reference](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/api-reference)**
- **[Deployment](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/deployment)**

---

## Deployment

OryCMS is a standard Next.js app, so it deploys anywhere Next.js runs:

- **Vercel** — `vercel deploy`
- **Docker** — `docker build -t orycms . && docker run -p 3000:3000 orycms`
- **Any Node host / VPS** — Hetzner, DigitalOcean, Railway, AWS, and others

See the **[Deployment guide](https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/deployment)** for the full checklist.

---

## Keeping OryCMS up to date

New features land on GitHub first, then ship as new npm versions. To upgrade:

```bash
npm install @ory-cms/core@latest @ory-cms/next@latest
npx @ory-cms/cli db:migrate     # apply any new schema changes (safe to re-run)
```

OryCMS follows semantic versioning. Breaking changes are documented in each package's `CHANGELOG.md` and in the [GitHub releases](https://github.com/orynticlabs/orycms/releases).

---

## Contributing

Contributions are welcome — bug reports, documentation fixes, new database adapters, and plugins.

```
fork → branch → commit → pull request
```

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting changes, and note the [Code of Conduct](./CODE_OF_CONDUCT.md).

For security issues, do **not** open a public issue — email **security@orynticlabs.com**. See [SECURITY.md](./SECURITY.md).

---

## Roadmap

- **Now** — CMS core, authentication, admin dashboard, media library, REST API, plugin engine
- **Next** — `@ory-cms/react` frontend hooks, `@ory-cms/plugin-sdk`, ecommerce collections, form builder
- **Later** — visual page builder, multi-tenant support, workflow automation

---

## License

[MIT](./LICENSE) © OrynticLabs Private Limited

---

<div align="center">

**OryCMS** — Build. Manage. Scale.

Built by [OrynticLabs Private Limited](https://github.com/orynticlabs)

</div>
