# @ory-cms/core

The OryCMS runtime engine — auth, schema, content, plugins, hooks, RBAC, and database adapters.

## Installation

```bash
npm install @ory-cms/core
```

## Requirements

- Node.js 18+
- PostgreSQL 14+ (or another supported adapter)

## What's included

| Module | Exports |
|---|---|
| Schema engine | `defineOryCMSCollection`, `registerOryCMSCollection` |
| Authentication | `loginOryCMSUser`, `logoutOryCMSUser`, `protectOryCMSAdminRoute` |
| RBAC | `hasOryCMSPermission`, `requireOryCMSPermission` |
| Hooks | `registerOryCMSHook`, `runOryCMSBeforeHooks`, `runOryCMSAfterHooks` |
| Database | `OryCMSDatabaseAdapter` + PostgreSQL/MySQL/MongoDB/Firebase/Oracle adapters |
| Config | `defineOryCMSConfig` |
| Migrations | `installOryCMSCoreSchema` |

## Usage

```ts
import { defineOryCMSConfig, defineOryCMSCollection } from "@ory-cms/core";

const Posts = defineOryCMSCollection({
  name: "Posts",
  slug: "posts",
  tableName: "posts",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body",  type: "richText" },
  ],
});

export default defineOryCMSConfig({
  collections: [Posts],
});
```

## Links

- **GitHub**: https://github.com/orynticlabs/orycms
- **Docs**: https://app.gitbook.com/s/CeQC9SBiUJdsP67uHBWI/
- **npm**: https://www.npmjs.com/package/@ory-cms/core
