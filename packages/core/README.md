# @ory-cms/core

The OryCMS MVP runtime for first-run setup, login, and database-backed sessions.

## Install

```bash
npm install @ory-cms/core @ory-cms/next
```

Set `ORYCMS_DATABASE_URL` to PostgreSQL, then mount the handlers in one Next.js App Router catch-all route:

```ts
// app/api/orycms/[...ory]/route.ts
import { createOryCMSRouteHandlers } from "@ory-cms/core/next";

export const { GET, POST, PATCH, PUT, DELETE } = createOryCMSRouteHandlers();
```

The first request to `/api/orycms/auth/setup-status` installs the minimal auth schema. `POST /api/orycms/auth/setup` creates the Owner; login returns an HTTP-only session cookie.

Advanced content, media, plugin, SEO, commerce, and analytics runtimes are not part of this MVP package.
