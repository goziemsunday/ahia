# AGENTS.md

## Repo overview

Full-stack e-commerce monorepo: Turborepo + Bun workspaces.

- `apps/api` (`@repo/api`) — Hono on Bun, port 8000
- `apps/web` (`@repo/web`) — Next.js 16 / React 19, port 3000
- `packages/db` (`@repo/db`) — Drizzle ORM + PostgreSQL
- `packages/permissions` (`@repo/permissions`) — Better Auth RBAC roles

## Commands

```bash
bun install                   # install deps (linker = "isolated" in bunfig.toml)
turbo run db:up               # start PostgreSQL via Docker on port 5434 (NOT 5432)
turbo run dev                 # start API + Web concurrently
turbo run build               # production build (API compiles to standalone binary)
bun lint --deny-warnings      # CI lint — must pass with zero warnings
bun fmt:check                 # CI format check (oxfmt)
bun lint                      # lint without deny
bun lint:fix                  # auto-fix lint issues
bun fmt                       # auto-format (oxfmt)
```

Single package verification:

```bash
turbo run build --filter=@repo/api
turbo run build --filter=@repo/web
turbo run check-types
```

Stripe webhook forwarding (for local dev):

```bash
bun run --filter=@repo/api stripe
```

Database operations:

```bash
turbo run db:generate   # generate migrations from schema changes
turbo run db:migrate    # run pending migrations
turbo run db:push       # push schema directly (no migration file)
turbo run db:studio     # Drizzle Studio UI
turbo run db:psql       # psql shell into the running container
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

- Path alias: `@/*` → `./src/*` in both apps
- Package imports: `@repo/db`, `@repo/permissions` (workspace protocol)
- Formatting: oxfmt with sorted imports (builtin → external → `@repo/**` → internal → relative → style), Tailwind class sorting, package.json script sorting
- Linting: oxlint with unicorn, typescript, import, react, react-perf, jsx-a11y plugins. `import/no-cycle` is warn-only. Several react-perf rules disabled.
- Generated files excluded from lint/format: `**/generated/**`, `**/migrations/**`, `**/*.gen.*`, `**/worker-configuration.d.ts`
- DB schema casing: `snake_case` (Drizzle configured with `casing: "snake_case"`)
- Env validation: `@t3-oss/env` (core for API/DB, nextjs adapter for web). Missing env fails at startup.
- API builds to standalone binary via `bun build --compile`
- Web enables React Compiler (`reactCompiler: true`) and `cacheComponents: true`
- shadcn base-nova style, hugeicons icon library
- Releases: semantic-release on `main` and `beta` (prerelease) branches

## Architecture notes

- API routes: `/api/user`, `/api/admin`, `/api/categories`, `/api/products`, `/api/orders`, `/api/cart`, `/api/health`
- Stripe webhooks are routed to a separate bare Hono app (no middleware) to preserve raw request body for signature verification
- Superadmin auto-created on API startup (skipped in test env)
- Better Auth session cookie: `ahia_auth_session`, httpOnly, 30-day expiry
- Auth roles defined in `packages/permissions`: `user`, `admin`, `superadmin`
- Web app uses `nuqs` for URL query state, `@tanstack/react-query` for server state
