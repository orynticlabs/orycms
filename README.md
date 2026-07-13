# OryCMS

<div align="center">

### The Modern CMS & Application Platform for Next.js

Build content-rich websites, ecommerce experiences, admin dashboards, and custom business applications with a powerful TypeScript backend and enterprise-grade admin panel.

Built by Oryntic Labs.

</div>

---

## Overview

OryCMS is an open-source fullstack platform built on Next.js that combines content management, admin tools, APIs, authentication, and developer-friendly workflows into a single integrated experience.

Whether you're building a marketing website, ecommerce platform, SaaS product, internal dashboard, or enterprise application, OryCMS provides the foundation to launch faster and scale confidently.

## Why OryCMS?

Most CMS solutions force teams to choose between flexibility and speed.

OryCMS delivers both.

### Key Benefits

- Fullstack Next.js architecture
- Built-in Admin Dashboard
- TypeScript-first development
- Flexible content modeling
- Authentication & Role Management
- Media Library
- API-first architecture
- SEO-ready content management
- Ecommerce-ready foundation
- Self-hosted and open source
- Developer-friendly experience
- Enterprise-grade scalability

---

# Features

## Content Management

- Dynamic content collections
- Custom fields and schemas
- Rich text editor
- Media management
- Drafts and publishing workflows
- Version history
- Scheduled publishing
- SEO metadata support

## Admin Dashboard

- Modern enterprise-grade interface
- Analytics overview
- User management
- Content moderation
- Role-based access control
- Activity logs
- Quick actions
- Global search

## Developer Experience

- TypeScript support
- Next.js App Router
- REST APIs
- GraphQL APIs
- Custom endpoints
- Hooks & lifecycle events
- Plugin architecture
- Reusable UI components

## Authentication

- Email & password login
- Social authentication
- Role management
- Team permissions
- Protected routes
- Session management

## Media Management

- Image uploads
- Video uploads
- File management
- Cloud storage support
- Image optimization
- CDN integration

## Ecommerce Foundation

- Products
- Categories
- Inventory
- Orders
- Customers
- Coupons
- Discounts
- Analytics

---

# Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Shadcn UI

### Backend

- Next.js Server Actions
- TypeScript
- REST API
- GraphQL API

### Database

Supported databases:

- PostgreSQL
- MongoDB
- MySQL (optional)

### Authentication

- NextAuth/Auth.js
- JWT
- OAuth Providers

### Storage

- Local Storage
- AWS S3
- Cloudflare R2
- Supabase Storage

---

# Project Structure

```bash
orycms/
│
├── src/
│   ├── app/
│   ├── admin/
│   ├── collections/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── providers/
│   └── styles/
│
├── public/
├── uploads/
├── docs/
├── scripts/
│
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

# npm Packages

OryCMS is distributed as a set of focused npm packages under the `@ory-cms` scope.

| Package | Status | Purpose |
|---|---|---|
| `@ory-cms/core` | Coming soon | Schema engine, RBAC, hooks, auth, database adapters |
| `@ory-cms/next` | Coming soon | Next.js 15 integration — admin panel, API routes, middleware |
| `@ory-cms/react` | Coming soon | Headless React hooks for frontend consumption |
| `@ory-cms/cli` | **Published** | CLI — init, migrate, seed, plugin commands |
| `@ory-cms/plugin-sdk` | Coming soon | Types and helpers for building plugins |
| `create-ory-cms` | Coming soon | Project scaffolder — `npx create-ory-cms` |

> **Note:** `@ory-cms/cli` is published and functional, but it generates projects that depend on `@ory-cms/core` and `@ory-cms/next`. Until those packages are published, **use the git-clone installation below**.

---

# Getting Started

## Prerequisites

- Node.js 22+ or 24+
- PostgreSQL
- Git

---

## Installation

### Option A — Git clone (recommended until all packages are published)

```bash
git clone https://github.com/orynticlabs/orycms.git
cd orycms
npm install
cp .env.example .env
npm run dev
```

Application available at `http://localhost:3000`.

---

### Option B — npm (once all packages are published)

**New project:**

```bash
npx create-ory-cms my-app
cd my-app
```

**Add to an existing Next.js project:**

```bash
# 1. Install the runtime packages
npm install @ory-cms/core @ory-cms/next

# 2. Run the interactive init wizard
npx @ory-cms/cli init

# 3. Apply database migrations
npx @ory-cms/cli db:migrate
```

**Optional packages:**

```bash
# React hooks for your frontend
npm install @ory-cms/react

# Plugin development
npm install --save-dev @ory-cms/plugin-sdk
```

> Installing `@ory-cms/cli` alone is not enough. The CLI scaffolds your project and tells you to install `@ory-cms/core`, which is the actual CMS engine. You need **both** the CLI and the core package for a working setup.

---

## Environment Variables

```env
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/orycms

# Auth (required)
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000

# Storage (optional)
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=

# Email (optional)
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
```

---

## Database Setup

Run migrations:

```bash
npm run db:migrate
```

Seed development data:

```bash
npm run db:seed
```

Open database studio:

```bash
npm run db:studio
```

---

# Admin Dashboard

Access the admin panel:

```text
http://localhost:3000/admin
```

Default capabilities include:

- Content Management
- User Management
- Analytics
- Media Library
- Ecommerce Operations
- Settings

---

# API Access

## REST API

```bash
GET /api/posts
GET /api/products
POST /api/posts
PATCH /api/posts/:id
DELETE /api/posts/:id
```

---

## GraphQL

```bash
POST /api/graphql
```

Example Query:

```graphql
query {
  posts {
    title
    slug
  }
}
```

---

# Deployment

## Vercel

```bash
vercel deploy
```

## Docker

```bash
docker build -t orycms .
docker run -p 3000:3000 orycms
```

## VPS

Recommended:

- Hetzner
- DigitalOcean
- AWS
- Hostinger VPS
- Railway

---

# Security

OryCMS includes:

- CSRF Protection
- Secure Authentication
- Rate Limiting
- Input Validation
- XSS Protection
- Content Sanitization
- Role-Based Permissions

---

# Roadmap

## Version 1

- CMS Core
- Authentication
- Admin Dashboard
- Media Library
- APIs

## Version 2

- Ecommerce Suite
- Email Marketing
- Form Builder
- Workflow Automation

## Version 3

- AI Content Assistant
- AI Search
- Visual Page Builder
- Multi-Tenant Support

---

# Contributing

We welcome contributions from the community.

```bash
fork → branch → commit → pull request
```

Please read the contribution guidelines before submitting changes.

---

# License

MIT License

Copyright © Oryntic Labs

---

# About Oryntic Labs

Oryntic Labs builds modern developer tools, SaaS platforms, and enterprise-grade products focused on performance, scalability, and exceptional user experience.

---

<div align="center">

### OryCMS

Build. Manage. Scale.

Powered by OrynticLabs.

</div>
