# create-orycms

Scaffold [OryCMS](https://github.com/orynticlabs/orycms) into a new or existing Next.js project — supports both App Router and Pages Router.

## Features

- Interactive setup wizard for database provider selection and connection
- Supports PostgreSQL, Neon, Supabase, MySQL, MariaDB, MongoDB, SQLite, and Firebase
- Generates `orycms.config.ts`, admin route handler, `.env.example`, and updates `tsconfig.json`
- Auto-detects Next.js version, router type, and package manager (npm / pnpm / yarn / bun)
- Works with both App Router and Pages Router projects
- `--skip-db` flag for CI / offline environments

## Requirements

- Node.js >= 18
- A Next.js project (App Router or Pages Router)

## Quick Start

```bash
npx create-orycms
```

Or with other package managers:

```bash
pnpm create orycms
yarn create orycms
bunx create-orycms
```

Run inside an existing Next.js project directory, or pass `--cwd` to target a specific path.

## Options

| Option | Description |
|--------|-------------|
| `--cwd <path>` | Target directory (defaults to `process.cwd()`) |
| `--skip-db` | Skip database connection test and all DB operations |

## Examples

```bash
# Run interactively in the current directory
npx create-orycms

# Target a specific directory
npx create-orycms --cwd ./my-app

# Skip database setup (useful in CI)
npx create-orycms --skip-db
```

## What Gets Created

After running `create-orycms`, the following files are created or updated in your project:

| File | Status |
|------|--------|
| `orycms.config.ts` | Created |
| `app/api/orycms/[...route]/route.ts` | Created |
| `.env.example` | Created |
| `tsconfig.json` | Updated |
| `package.json` | Updated |

## Links

- **GitHub**: https://github.com/orynticlabs/orycms
- **Documentation**: https://github.com/orynticlabs/orycms#readme
- **Issues**: https://github.com/orynticlabs/orycms/issues
- **npm**: https://www.npmjs.com/package/create-orycms
