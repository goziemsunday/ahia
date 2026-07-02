# NestJS Migration — Phase 1: Core Infrastructure

## Goal

Set up the NestJS foundation so every subsequent module (products, categories, cart, orders, admin, stripe) follows the same patterns.

## 1.1 — Install dependencies

```bash
bun add --filter=@repo/nest nestjs-zod zod
```

`nestjs-zod` provides `ZodValidationPipe` which we configure globally to reuse existing Zod schemas from `@repo/db/validators/*`.

## 1.2 — Replace `utils.ts` with Hono's utility set

**`apps/nest/src/lib/utils.ts`** — port from `apps/api/src/lib/utils.ts`:

- `successResponse(data, pagination?)` → `{ data, ...(pagination ? { pagination } : {}) }`
- `errorResponse(details)` → `{ error: { details } }`
- `buildPagination(page, limit, total)`
- `toNumber(value)`
- `round(value)`
- `pctChange(current, previous)`
- `generatePassword(length)`

**`apps/nest/src/lib/types.ts`** — simplified response types:

```ts
export type SuccessRes<T> = {
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ErrorRes = {
  error: { details: string };
};
```

### Rationale for simplified shapes

- **No `status` field** — HTTP status code already signals success/failure
- **No `details` on success** — frontend uses its own messages; anything to communicate goes in `data`
- **No `error.code`** — redundant with HTTP status code (401, 404, 409, etc.)
- **No `error.fields`** — frontend never consumed it (confirmed via grep)
- **Keep `error.details`** — frontend uses this for user-facing error messages (`getApiError`, `getUser`)

## 1.3 — Global exception filter

**`apps/nest/src/common/filters/http-exception.filter.ts`**

Catches all exceptions and returns `{ error: { details: "..." } }` with the matching HTTP status code. Registered in `AppModule` via `APP_FILTER` provider.

Handles:
- `ZodValidationException` → 400 with per-field error messages from Zod issues
- `ZodSerializationException` → 500 (logs the error, hides details in prod)
- `HttpException` (and subclasses: `NotFoundException`, `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `ConflictException`, etc.) → maps to respective status code
- Unknown errors → 500 (dev: real message, prod: "Internal server error")

No `code`, no `status`, no `fields` — just `{ error: { details } }`.

## 1.4 — Auth guards (handled by `@thallesp/nestjs-better-auth`)

No custom guards needed. Routes are authed by default; use `@AllowAnonymous()` to mark public routes. User info is available through the library's mechanism.

## 1.5 — Global validation pipe + serializer interceptor

Registered via providers in `AppModule`:

```ts
import { APP_PIPE, APP_INTERCEPTOR } from "@nestjs/core";
import { ZodValidationPipe, ZodSerializerInterceptor } from "nestjs-zod";

@Module({
  imports: [...],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
```

`ZodValidationPipe` enables reusing existing `@repo/db/validators/*` schemas directly:

```ts
@Post()
create(@Body(CreateCategorySchema) body: typeof CreateCategorySchema._type) {…}
```

`ZodSerializerInterceptor` validates response bodies match their Zod schema (catches shape mismatches).

## 1.6 — AppModule (updated)

Exception filter, validation pipe, and serializer interceptor are all registered via providers in `AppModule`:

```ts
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe, ZodSerializerInterceptor } from "nestjs-zod";

import { HealthModule } from "./health/health.module";
import { auth } from "./lib/auth";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

@Module({
  imports: [
    HealthModule,
    AuthModule.forRoot({
      auth,
      bodyParser: { rawBody: true },
    }),
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

Bootstrap (`main.ts`) is lean — just creates the app (with `bodyParser: false`), sets global prefix + CORS:

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.setGlobalPrefix("api");
  app.enableCors({ origin: corsOrigins, credentials: true });

  await app.listen(5000);
}
void bootstrap();
```

- Global prefix `/api` moves health from `/health` to `/api/health`
- CORS uses `CORS_ORIGINS` env var (comma-separated) or falls back to `WEB_URL`

## 1.7 — Body parser

`bodyParser: false` on the factory is required (and already set). The `@thallesp/nestjs-better-auth` library re-adds body parsers for non-auth routes automatically.

Pass `bodyParser: { rawBody: true }` to `AuthModule.forRoot()` to make `req.rawBody` available for Stripe webhook signature verification. No custom body parser middleware needed.

## 1.8 — Update health module

```ts
@Controller("health") // → /api/health with global prefix
export class HealthController {
  @Get()
  health() {
    return successResponse({ status: "OK" });
  }
}
```

## 1.9 — Update frontend schemas

**`apps/web/src/lib/schemas.ts`**

```ts
export const successResSchema = <T>(data: z.ZodType<T>) =>
  z.object({
    data: data,
    pagination: z
      .object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
      })
      .optional(),
  });

export const errorResSchema = z.object({
  error: z.object({ details: z.string() }),
});
```

**`apps/web/src/features/user/queries.ts`** — replace the `error.code` check with the HTTP status check:

```ts
// Before:
parsed.success && parsed.data.error.code === "UNAUTHORIZED";
// After:
error.status === 401;
```

---

## File tree after Phase 1

```
apps/nest/src/
├── main.ts                              # updated (lean, no global pipes/filters)
├── app.module.ts                        # updated (providers for pipe, interceptor, filter)
├── common/
│   └── filters/
│       └── http-exception.filter.ts     # NEW
├── health/
│   ├── health.module.ts                 # same
│   └── health.controller.ts             # updated response format
└── lib/
    ├── auth.ts                          # same
    ├── env.ts                           # same
    ├── types.ts                         # replaced
    └── utils.ts                         # replaced
```

---

## Pattern for Phase 2+ modules

```ts
@Controller("categories")
export class CategoriesController {
  @Get()
  async findAll(@Query(PaginationQuerySchema) query: PaginationQuery) {
    const { categories, total } = await getCategories(query);
    return successResponse(
      categories,
      buildPagination(query.page, query.limit, total),
    );
  }

  @Post()
  async create(@Body(CreateCategorySchema) body: CreateCategory) {
    return successResponse(await createCategory(body.name));
  }
}
```

Auth is handled at the module level — the `AuthModule.forRoot()` import protects all routes by default. Public routes are annotated with `@AllowAnonymous()`.
