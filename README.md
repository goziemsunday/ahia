# Ahia

A full-stack e-commerce platform. You get an API, a storefront, and an admin dashboard, all with proper type safety and without the bloat.

## What You Get

Ahia provides a complete e-commerce experience:

- **Storefront:** Browse products by category, search, view details, manage shopping cart, and checkout with Stripe
- **Admin Dashboard:** Real-time stats, product/category management, user administration, order fulfillment, and customer impersonation
- **User System:** Email/password and Google OAuth authentication with role-based access control (user, admin, superadmin)
- **Orders:** Immutable order tracking from checkout through fulfillment
- **Storage:** Product images hosted on Cloudflare R2
- **Notifications:** Transactional emails (verification, reset, order receipts) via Resend

## Stack

**Backend:** [Hono](https://hono.dev) on [Bun](https://bun.sh) for the API, [Better-Auth](https://better-auth.com) for auth, and PostgreSQL + [Drizzle](https://orm.drizzle.team) for data.

**Frontend:** [Next.js](https://nextjs.org) with React 19, TanStack React Query for server state, React Form + React Table for forms and tables, and [Tailwind](https://tailwindcss.com) for styling.

**Monorepo:** [Turborepo](https://turborepo.dev) orchestrates the build and Bun manages packages.

**Integrations:** [Stripe](https://stripe.com) for payments, [Resend](https://resend.com) for transactional email, and [Cloudflare R2](https://www.cloudflare.com/products/r2) for image storage.

## Getting Started

### Prerequisites

- Bun 1.3.11+
- Docker

### 1. Clone & Install

```bash
git clone <repo-url>****
cd ahia
bun install
```

### 2. Environment Variables

Each app has its own `.env.example` file. Copy them to create `.env` files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
```

Fill in the values with your actual credentials (Stripe keys, Cloudflare R2, Resend, Google OAuth, etc.).

### 3. Start Database

```bash
turbo run db:up
```

This spins up PostgreSQL in Docker and runs migrations.

### 4. Run Development Servers

```bash
turbo run dev
```

This starts all services concurrently:

- API: `http://localhost:8000`
- Web: `http://localhost:3000`
- API Docs: `http://localhost:8000/api/reference`

### 5. Build for Production

```bash
turbo run build
```

## Authentication & Authorization

- **Session-based:** Tokens stored in secure httpOnly cookies
- **OAuth:** Google login supported
- **Roles:** User, Admin, Superadmin with granular permissions
- **Impersonation:** Admins can impersonate users for support/debugging
- **Admin Plugin:** Role-based middleware integrated into Better-Auth

## License

See [LICENSE](LICENSE) for details.
