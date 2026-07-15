# AGENTS.md

## Repo overview

Full-stack e-commerce monorepo: Turborepo + Bun workspaces.

- `apps/api` (`@repo/nest`) — NestJS 11 API, port 5000
- `apps/web` (`@repo/web`) — Next.js 16 / React 19, port 3000
- `packages/db` (`@repo/db`) — Drizzle ORM + PostgreSQL
- `packages/permissions` (`@repo/permissions`) — Better Auth RBAC roles

## VCS

Jujutsu (`.jj/`) is the primary VCS. Not git.

## Commands

```bash
bun install                   # install deps (linker = "isolated" in bunfig.toml)
turbo run db:up               # start PostgreSQL via Docker on port 5434 (NOT 5432)
turbo run dev                 # start all services (DB auto-started via dependsOn)
turbo run build               # production build
bun lint --deny-warnings      # CI lint — must pass with zero warnings
bun fmt:check                 # CI format check (oxfmt)
bun lint                      # lint without deny
bun lint:fix                  # auto-fix lint issues
bun lint:type                 # type-aware linting (oxlint --type-aware)
bun fmt                       # auto-format (oxfmt)
turbo run check-types         # type-check all packages
turbo run start               # production start (NestJS + Web)
```

Single package verification:

```bash
turbo run build --filter=@repo/nest
turbo run build --filter=@repo/web
turbo run check-types --filter=@repo/nest
```

Stripe webhook forwarding (for local dev):

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Database operations:

```bash
turbo run db:generate   # generate migrations from schema changes
turbo run db:migrate    # run pending migrations
turbo run db:push       # push schema directly (no migration file)
turbo run db:studio     # Drizzle Studio UI
turbo run db:psql       # psql shell into the running container
turbo run db:down       # stop DB container
turbo run db:delete     # stop DB container + delete volumes
```

## Setup

Three `.env` files required — copy from `.env.example`:

- `apps/api/.env`
- `apps/web/.env`
- `packages/db/.env`

`BETTER_AUTH_SECRET` must be generated: `openssl rand -hex 32`

DB connection string uses port **5434** (mapped from container's 5432). Default credentials: user `user`, password `secret`, database `ahia`.

## CI

Two workflows in `.github/workflows/`:

- `lint.yaml` — runs on PRs to main: `bun install --frozen-lockfile`, `bun lint --deny-warnings`, `bun fmt:check`
- `release.yaml` — runs on push to main: lint then semantic-release (Node.js, not Bun)

## Conventions

- Path alias: `@/*` → `./src/*` in Web only (NestJS uses relative imports)
- Package imports: `@repo/db`, `@repo/permissions` (workspace protocol)
- Formatting: oxfmt with sorted imports (builtin → external → `@repo/**` → internal → relative → style), Tailwind class sorting, package.json script sorting
- Linting: oxlint with unicorn, typescript, import, react, react-perf, jsx-a11y plugins. `import/no-cycle` is warn-only. Several react-perf rules disabled.
- Generated files excluded from lint/format: `**/generated/**`, `**/migrations/**`, `**/*.gen.*`, `**/worker-configuration.d.ts`. `routeTree.gen.ts` is readonly.
- DB schema casing: `snake_case` (Drizzle configured with `casing: "snake_case"`)
- Env validation: `@t3-oss/env` (core for NestJS/DB, nextjs adapter for web). Missing env fails at startup.
- Web enables React Compiler (`reactCompiler: true`) and `cacheComponents: true`, Tailwind v4 via `@tailwindcss/postcss`
- shadcn base-nova style, hugeicons icon library
- No tests in repo (no jest/vitest config)
- Releases: semantic-release on `main` and `beta` (prerelease) branches

## Architecture notes

- API routes (NestJS on port 5000): `/api/{health,user,admin,categories,products,orders,cart}`, `/api/auth/*` (Better Auth), `/api/webhooks/stripe`, API docs at `/api/reference` (Scalar)
- Stripe webhook receiver preserves raw request body for signature verification
- Superadmin auto-created on NestJS startup (skipped in test env)
- Auth roles defined in `packages/permissions`: `user`, `admin`, `superadmin`
- Web app uses `nuqs` for URL query state, `@tanstack/react-query` for server state
- `packages/db` exposes multiple export paths: `.`, `./schemas/*`, `./validators/*`
- Docker image runs migration script then NestJS app
- Recommended VS Code extension: `oxc.oxc-vscode` (see `.vscode/extensions.json`)
