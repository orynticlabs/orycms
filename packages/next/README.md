# @ory-cms/next

The OryCMS MVP first-run UI for Next.js: setup, login, session provider, and a working admin dashboard shell.

## Install

```bash
npm install @ory-cms/core @ory-cms/next
```

Set `ORYCMS_DATABASE_URL` to a PostgreSQL connection string and import the package CSS in `app/layout.tsx`:

```tsx
import "@ory-cms/next/styles.css";
```

Add these App Router files:

```tsx
// app/setup/page.tsx
export { OryCMSSetupPage as default } from "@ory-cms/next";

// app/login/page.tsx
export { OryCMSLoginPage as default } from "@ory-cms/next";

// app/admin/page.tsx
export { OryCMSAdmin as default } from "@ory-cms/next";
```

```ts
// app/api/orycms/[...ory]/route.ts
import { createOryCMSRouteHandlers } from "@ory-cms/core/next";

export const { GET, POST, PATCH, PUT, DELETE } = createOryCMSRouteHandlers();
```

Start Next.js and open `/setup`, then `/login`, then `/admin`.

## MVP scope

This release intentionally includes only authentication, first-run setup, the session provider, dashboard shell, sidebar, and minimal dashboard UI. Collections, Content, Media, Plugins, SEO, Commerce, Analytics, and other advanced modules remain in the OryCMS reference project for future package releases.
