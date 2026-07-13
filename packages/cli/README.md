# @ory-cms/cli

Official command-line interface for [OryCMS](https://github.com/orynticlabs/orycms) — the headless CMS built for Next.js.

## Features

- **`init`** — scaffold OryCMS into an existing Next.js App Router project with an interactive setup wizard
- **`plugin`** — install, uninstall, update, enable, disable, and list OryCMS plugins
- **`config`** — initialise and inspect your `orycms.config.ts` file
- Supports PostgreSQL, Neon, Supabase, MySQL, MariaDB, MongoDB, SQLite, and Firebase
- Detects your package manager (npm / pnpm / yarn / bun) automatically

## Requirements

- Node.js >= 18
- A Next.js project using the App Router
- **`@ory-cms/core`** installed in your project (see below)

## Installation

```bash
npm install -g @ory-cms/cli
```

Or run directly without installing:

```bash
npx @ory-cms/cli init
```

> **Important:** `@ory-cms/cli` is the scaffolding and management tool. It does not include the OryCMS runtime. Your project also needs `@ory-cms/core` and `@ory-cms/next` to function. Install them before or immediately after running `orycms init`:
>
> ```bash
> npm install @ory-cms/core @ory-cms/next
> ```

## Quick Start

Inside an existing Next.js project:

```bash
# 1. Install the runtime packages first
npm install @ory-cms/core @ory-cms/next

# 2. Run the CLI wizard
npx @ory-cms/cli init
```

The wizard will:
1. Detect your Next.js version and App Router
2. Prompt for database provider and connection string
3. Generate `orycms.config.ts`, admin route, `.env.example`, and update `tsconfig.json`
4. Print the exact `npm install` command for any additional dependencies (db drivers, auth, plugins)

## Commands

### `orycms init`

Initialise OryCMS in an existing Next.js App Router project.

```
orycms init [--cwd <path>]
```

| Option | Description |
|--------|-------------|
| `--cwd <path>` | Target directory (defaults to `process.cwd()`) |

### `orycms plugin`

Manage OryCMS plugins.

```
orycms plugin install <package>
orycms plugin uninstall <package>
orycms plugin update <package>
orycms plugin list
orycms plugin enable <name>
orycms plugin disable <name>
```

### `orycms config`

Manage OryCMS configuration.

```
orycms config show          # Print resolved config
orycms config init          # Re-generate orycms.config.ts
```

## Examples

```bash
# Initialise in current directory
orycms init

# Initialise in a specific directory
orycms init --cwd ./my-nextjs-app

# Install a plugin
orycms plugin install @ory-cms/plugin-seo

# View current config
orycms config show
```

## Links

- **GitHub**: https://github.com/orynticlabs/orycms
- **Documentation**: https://github.com/orynticlabs/orycms#readme
- **Issues**: https://github.com/orynticlabs/orycms/issues
- **npm**: https://www.npmjs.com/package/@ory-cms/cli
