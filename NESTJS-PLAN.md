# NestJS Migration

# Phase 1: Core Infrastructure

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

# Phase 2: User Module

## Goal

Port the three user routes (`GET /me`, `PATCH /me`, `POST /me/password`) from the Hono API to NestJS. All are thin wrappers around Better Auth's built-in methods — no custom services or direct DB queries needed.

## 2.1 — New files

```
apps/nest/src/user/
├── user.controller.ts
├── user.module.ts
└── user.dto.ts
```

## 2.2 — `user.dto.ts`

```ts
import { createZodDto } from "nestjs-zod";
import {
  UserUpdateSchema,
  ChangePasswordSchema,
} from "@repo/db/validators/user.validator";

export class UpdateUserDto extends createZodDto(UserUpdateSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
```

DTO classes give us OpenAPI compatibility and `strictSchemaDeclaration` support — the idiomatic nestjs-zod pattern.

## 2.3 — `user.controller.ts`

| Method  | Path          | DTO                 | Implementation                                                                |
| ------- | ------------- | ------------------- | ----------------------------------------------------------------------------- |
| `GET`   | `me`          | —                   | `@Session()` → `successResponse(session.user)`                                |
| `PATCH` | `me`          | `UpdateUserDto`     | `authService.api.updateUser({ body, headers: fromNodeHeaders(req.headers) })` |
| `POST`  | `me/password` | `ChangePasswordDto` | `authService.api.changePassword({ body, headers: /* Bearer */ })`             |

```ts
import { Controller, Get, Patch, Post, Body, Req } from "@nestjs/common";
import { AuthService, Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "@/lib/auth";
import { successResponse } from "@/lib/utils";
import { UpdateUserDto, ChangePasswordDto } from "./user.dto";

@Controller("user")
export class UserController {
  constructor(private readonly authService: AuthService) {}

  @Get("me")
  getMe(@Session() session: UserSession<typeof auth>) {
    return successResponse(session.user);
  }

  @Patch("me")
  async updateMe(@Body() body: UpdateUserDto, @Req() req: Request) {
    const user = await this.authService.api.updateUser({
      body,
      headers: fromNodeHeaders(req.headers),
    });
    return successResponse(user);
  }

  @Post("me/password")
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Session() session: UserSession<typeof auth>,
  ) {
    await this.authService.api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: body.revokeOtherSessions,
      },
      headers: new Headers({
        Authorization: `Bearer ${session.session.token}`,
      }),
    });
    return successResponse({ status: true });
  }
}
```

> **`PATCH /me`** passes raw request headers so Better Auth finds the session cookie.
> **`POST /me/password`** uses `session.session.token` as a Bearer token (matches the Hono implementation).

## 2.4 — `user.module.ts`

```ts
import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";

@Module({ controllers: [UserController] })
export class UserModule {}
```

## 2.5 — Register in `AppModule`

```diff
 imports: [
   HealthModule,
+  UserModule,
   AuthModule.forRoot({ auth, bodyParser: { rawBody: true } }),
 ],
```

## 2.6 — No frontend changes needed

The web app already sends `credentials: "include"` and parses `{ data }` via `successResSchema()`. No response shape change required.

## 2.7 — No body parser changes

`AuthModule.forRoot({ bodyParser })` already re-adds JSON parsing for non-auth routes — the library handles it.

## 2.8 — Error handling

Everything is catch-all via the global `HttpExceptionFilter`:

- `ZodValidationException` → 400 with per-field issues
- `APIError` from Better Auth → `UnauthorizedException`, `BadRequestException`, etc. → proper HTTP status
- No try/catch needed in controller

---

# Phase 3: Categories Module

## Goal

Port the six category routes (3 public GET, 3 admin write) from the Hono API to NestJS. More complex than User — introduces service layer with transactions, slug generation, and RBAC via `@UserHasPermission()`.

## 3.1 — New files

```
apps/nest/src/common/dto/
└── shared.dto.ts                        ← single file, all shared DTOs

apps/nest/src/lib/
├── slug.ts                              ← port from Hono (buildBaseSlug, resolveSlugCollision)
└── types.ts                             ← updated with DbOrTx type

apps/nest/src/category/
├── categories.controller.ts
├── categories.module.ts
├── categories.service.ts
├── categories.dto.ts
├── categories.types.ts
└── categories.utils.ts                  ← utility functions (findCategoryByCaseInsensitiveName, generateUniqueCategorySlug)
```

## 3.2 — `apps/nest/src/common/dto/shared.dto.ts`

```ts
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class UuidParamDto extends createZodDto(
  z.object({ id: z.string().uuid() }),
) {}

export class PaginationQueryDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
) {}

export class LimitQueryDto extends createZodDto(
  z.object({ limit: z.coerce.number().int().positive().optional() }),
) {}
```

## 3.3 — `apps/nest/src/category/categories.dto.ts`

```ts
import { createZodDto } from "nestjs-zod";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from "@repo/db/validators/product.validator";

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
```

## 3.4 — Routes

| Method   | Path              | Auth                                                                       | DTO                                  | Handler                    |
| -------- | ----------------- | -------------------------------------------------------------------------- | ------------------------------------ | -------------------------- |
| `GET`    | `/categories`     | `@AllowAnonymous()`                                                        | `PaginationQueryDto`                 | `service.getAll`           |
| `GET`    | `/categories/top` | `@AllowAnonymous()`                                                        | `LimitQueryDto`                      | `service.getTop`           |
| `GET`    | `/categories/:id` | `@AllowAnonymous()`                                                        | `UuidParamDto`                       | `service.getOneById` → 404 |
| `POST`   | `/categories`     | `@UserHasPermission({permission:{category:["create","update","delete"]}})` | `CreateCategoryDto`                  | `service.create(name)`     |
| `PUT`    | `/categories/:id` | `@UserHasPermission({permission:{category:["create","update","delete"]}})` | `UuidParamDto` + `UpdateCategoryDto` | `service.update(id, name)` |
| `DELETE` | `/categories/:id` | `@UserHasPermission({permission:{category:["create","update","delete"]}})` | `UuidParamDto`                       | `service.delete(id)`       |

Uses `@UserHasPermission` (granular, from the Better Auth NestJS library) instead of `@Roles` — maps directly to the Hono API's `permit({ category: [...] })` middleware.

## 3.5 — `categories.service.ts`

`@Injectable()`, imports `db` from `@repo/db`. Single entry point for all data access — reads and writes:

| Method                  | Transaction | Errors                                                  | Description                                                                                           |
| ----------------------- | ----------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `getAll(page?, limit?)` | —           | —                                                       | Paginated list with `productCount`                                                                    |
| `getTop(limit?)`        | —           | —                                                       | Top N sorted by product count (desc)                                                                  |
| `getOneById(id)`        | —           | `NotFoundException`                                     | Single category with products                                                                         |
| `getByIds(ids)`         | —           | —                                                       | Bulk check (used by product module) — placeholder                                                     |
| `create(name)`          | ✅          | `ConflictException`                                     | Trim, check uniqueness (case-insensitive), generate slug, insert                                      |
| `update(id, name)`      | ✅          | `NotFoundException`, `ConflictException`                | Check existence, short-circuit if same name, check uniqueness (exclude self), regenerate slug, update |
| `delete(id)`            | ✅          | `NotFoundException`, `ConflictException` (has products) | Check existence, reject if products associated, delete                                                |

Service throws `HttpException` subclasses (`NotFoundException`, `ConflictException`) on failure — global filter handles them. No discriminated union return types, no `try/catch` needed in the service.

## 3.6 — `categories.controller.ts`

- Injects only `CategoriesService`
- Public GET routes use `@AllowAnonymous()`
- Write routes use `@UserHasPermission({ permission: { category: ["create", "update", "delete"] } })`
- No `try/catch` — service throws NestJS exceptions, filter handles them
- POST defaults to 201 (NestJS convention)

## 3.7 — Register in `AppModule`

```diff
 imports: [
   HealthModule,
   UserModule,
+  CategoriesModule,
   AuthModule.forRoot({...}),
 ],
```

## 3.8 — Frontend

Check `apps/web/src/features/categories/` for any response-dependent code. Likely no changes needed — frontend already consumes `{ data }` via `successResSchema()`.
