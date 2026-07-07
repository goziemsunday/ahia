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

---

# Phase 4: Products Module

## Goal

Port all 9 product routes (7 public + 3 admin) from the Hono API to NestJS. This is the largest module — introduces multipart form-data handling (Multer), R2 image upload, cross-field validation, and slug collision resolution.

## 4.1 — New files

```
apps/nest/src/product/
├── products.controller.ts
├── products.service.ts
├── products.module.ts
├── products.dto.ts
├── products.types.ts
└── products.utils.ts

apps/nest/src/lib/
├── file.ts              ← port from Hono's lib/file.ts (adapted for Express Multer)
├── r2.ts                ← port from Hono's lib/r2.ts (adapted for Buffer upload)
└── image-upload.ts      ← port from Hono's lib/image-upload.ts
```

## 4.2 — Dependency to add

```bash
bun add --filter=@repo/nest @aws-sdk/client-s3
```

`@aws-sdk/client-s3` provides `S3Client`, `PutObjectCommand`, `DeleteObjectCommand` for R2.

No `@types/multer` needed — define a minimal `MulterFile` local interface instead of relying on `Express.Multer.File` types.

## 4.3 — `apps/nest/src/lib/file.ts`

Port of Hono's `lib/file.ts`, adapted for Express Multer file format (uses `mimetype`, `size`, `buffer` instead of Web `File`'s `type`, `size`, `arrayBuffer()`).

```ts
export const MAX_FILE_SIZE = 512 * 1024;
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
export const MAX_PRODUCT_IMAGES = 3;
export const MIN_PRODUCT_IMAGES = 1;

export const validateFile = (
  file: { mimetype: string; size: number },
  index: number,
): void => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `Image ${index + 1}: File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    );
  }
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    throw new Error(
      `Image ${index + 1}: File type must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
    );
  }
};

export const validateProductImages = (
  files: { mimetype: string; size: number }[],
): void => {
  if (files.length < MIN_PRODUCT_IMAGES) {
    throw new Error(`At least ${MIN_PRODUCT_IMAGES} image is required`);
  }
  if (files.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Maximum ${MAX_PRODUCT_IMAGES} images allowed`);
  }
  files.forEach(validateFile);
};
```

## 4.4 — `apps/nest/src/lib/r2.ts`

Port of Hono's `lib/r2.ts`. The `uploadImageToR2` signature changes: accepts a `Buffer` + `mimetype` + `originalname` instead of a Web `File` (since Multer gives us `Express.Multer.File` with a `buffer` property, not a `File`).

```ts
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import env from "./env";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export const uploadImageToR2 = async (
  buffer: Buffer,
  mimetype: string,
  originalname: string,
  folder = "products",
) => {
  const ext = originalname.split(".").pop();
  const key = `${folder}/${randomUUID()}.${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }),
  );

  return { url: `${env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`, key };
};

export const deleteImageFromR2 = async (key: string) => {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
    }),
  );
};
```

## 4.5 — `apps/nest/src/lib/image-upload.ts`

Same orchestration as Hono's `lib/image-upload.ts` — batch upload, batch cleanup, rollback wrapper.

```ts
export interface UploadedImage {
  url: string;
  key: string;
}

export const uploadProductImages = async (
  files: { buffer: Buffer; mimetype: string; originalname: string }[],
  folder = "products",
): Promise<UploadedImage[]> => {
  return Promise.all(
    files.map((f) =>
      uploadImageToR2(f.buffer, f.mimetype, f.originalname, folder),
    ),
  );
};

export const cleanupUploadedImages = async (
  images: { key: string }[],
): Promise<void> => {
  if (images.length === 0) return;
  await Promise.allSettled(
    images.map((img) =>
      deleteImageFromR2(img.key).catch((err) => {
        console.error(`Failed to delete R2 object ${img.key}:`, err);
      }),
    ),
  );
};

export const withImageRollback = async <T>(
  uploaded: UploadedImage[],
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    await cleanupUploadedImages(uploaded);
    throw err;
  }
};
```

## 4.6 — `apps/nest/src/product/products.types.ts`

```ts
import type { z } from "zod";
import {
  ProductExtendedSchema,
  ProductSelectSchema,
} from "@repo/db/validators/product.validator";

export type Product = z.infer<typeof ProductSelectSchema>;
export type ProductWithRelations = z.infer<typeof ProductExtendedSchema>;
```

`ProductExtendedSchema` (from `@repo/db/validators/product.validator`) already includes `categories: CategorySelectSchema.array()` and `creator: UserSelectSchema.optional()`.

## 4.7 — `apps/nest/src/product/products.dto.ts`

DTOs for multipart endpoints accept raw form-field strings. JSON array fields (`sizes`, `colors`, `categoryIds`, `keepImageKeys`) are validated as `z.string()` — parsing happens in the service.

Query-param DTOs use `z.coerce` for proper types.

```ts
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

// Multipart form-data DTOs — raw string fields
export class CreateProductDto extends createZodDto(
  z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    price: z
      .string()
      .min(1)
      .regex(/^\d+(\.\d{2})?$/),
    stockQuantity: z.string().min(1),
    sizes: z.string().optional(),
    colors: z.string().optional(),
    categoryIds: z.string().optional(),
  }),
) {}

export class UpdateProductDto extends createZodDto(
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    price: z
      .string()
      .regex(/^\d+(\.\d{2})?$/)
      .optional(),
    stockQuantity: z.string().optional(),
    sizes: z.string().optional(),
    colors: z.string().optional(),
    categoryIds: z.string().optional(),
    keepImageKeys: z.string().optional(),
  }),
) {}

// Query-param DTOs — coerced types
export class ShopQueryDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(50),
    cat: z.string().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    sort: z.enum(["newest", "price-asc", "price-desc"]).optional(),
    new: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
  }),
) {}

export class SearchQueryDto extends createZodDto(
  z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().positive().optional(),
  }),
) {}
```

## 4.8 — `apps/nest/src/product/products.utils.ts`

Utility functions:

```ts
import { and, db, DbOrTx, eq, like, or } from "@repo/db";

import { resolveSlugCollision } from "../lib/slug";

export const parseJsonArray = (raw: string | undefined): unknown[] => {
  if (!raw || raw === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    throw new BadRequestException(`Invalid JSON: ${raw}`);
  }
};

export const generateUniqueProductSlug = async (
  baseSlug: string,
  excludeProductId?: string,
  executor: DbOrTx = db,
): Promise<string> => {
  const existingSlugs = await executor.query.product.findMany({
    where: excludeProductId
      ? (p) =>
          and(
            or(eq(p.slug, baseSlug), like(p.slug, `${baseSlug}-%`)),
            ne(p.id, excludeProductId),
          )
      : (p) => or(eq(p.slug, baseSlug), like(p.slug, `${baseSlug}-%`)),
    columns: { slug: true },
  });

  return resolveSlugCollision(
    baseSlug,
    new Set(existingSlugs.map((p) => p.slug)),
  );
};
```

## 4.9 — `apps/nest/src/product/products.service.ts`

Single `@Injectable()` service with all business logic. Key patterns:

### Read methods (direct map from Hono's `product-queries.ts`)

| Method                          | Transaction | Throws              | Notes                                                                                  |
| ------------------------------- | ----------- | ------------------- | -------------------------------------------------------------------------------------- |
| `getAll(page?, limit?)`         | —           | —                   | Paginated, `findMany` with `creator` + `productCategories.category` relations          |
| `getOneById(id)`                | —           | `NotFoundException` | Single product with relations                                                          |
| `getFeatured()`                 | —           | —                   | Daily rotation: `(YYYY*10000 + MM*100 + DD) % totalProducts` offset                    |
| `getLatest(limit?)`             | —           | —                   | `ORDER BY createdAt DESC`                                                              |
| `getTrending(limit?)`           | —           | —                   | `SUM(orderItem.quantity)` last 30 days, then fetch full details preserving sort order  |
| `getShopProducts(params)`       | —           | —                   | Fetch all → in-memory filter (cat, price, new) → sort → slice. Same pattern as Hono.   |
| `searchProducts(query, limit?)` | —           | —                   | `ilike` name matches first, then `ilike` description (excluding name matches), deduped |

### Write methods (adapted from Hono's `product-service.ts`)

| Method                          | Transaction | Throws                                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(dto, files, creatorId)` | ✅          | `BadRequestException` (field), `HttpException(422)` (image) | 1. Parse JSON fields 2. Validate images (count/type/size) 3. Cross-field validation (price/stock/variants) 4. Category existence check 5. Generate slug 6. Upload images to R2 7. DB transaction: insert product + `productCategory` joins 8. Refetch with relations 9. Image rollback on failure                                                                                       |
| `update(id, dto, files)`        | ✅          | `NotFoundException`, `BadRequestException`                  | 1. Fetch existing (404 if missing) 2. Parse JSON fields 3. Validate new images 4. Validate final image count (kept + new = 1–3) 5. Category existence check 6. Regenerate slug if name changed 7. Upload new images to R2 8. DB transaction: build update payload → update product → replace categories → refetch 9. Post-commit: delete removed images from R2 10. Rollback on failure |
| `delete(id)`                    | ✅          | `NotFoundException`, `ConflictException`                    | 1. Fetch existing (404 if missing) 2. Check `cartItem` + `orderItem` references (409 if found) 3. DB transaction delete 4. Post-commit: delete all images from R2                                                                                                                                                                                                                       |

### Cross-field validation (inlined into service)

```ts
// Price normalization
const normalizePrice = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return n.toFixed(2);
};

// Stock quantity normalization
const normalizeStockQuantity = (
  raw: string | undefined,
): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
};

// Variant validation: unique names + at least one inStock when stock > 0
const validateVariants = (
  field: string,
  items: { name: string; inStock: boolean }[],
  effectiveStock: number,
  fieldErrors: Record<string, string>,
): void => {
  if (items.length === 0) return;
  const names = items.map((i) => i.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    fieldErrors[field] = `${field} names must be unique (case-insensitive)`;
    return;
  }
  if (effectiveStock > 0 && !items.some((i) => i.inStock)) {
    fieldErrors[field] =
      `At least one ${field.slice(0, -1)} must be in stock when stock quantity is greater than 0`;
  }
};
```

### Error mapping (Hono discriminated union → NestJS exceptions)

| Hono return                                      | NestJS exception                                              |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `{ ok: false, type: "imageError", status: 422 }` | `new HttpException(HttpStatus.UNPROCESSABLE_ENTITY, message)` |
| `{ ok: false, type: "fieldError", fieldErrors }` | `new BadRequestException(field messages joined by "; ")`      |
| `{ ok: false, type: "conflict" }`                | `new ConflictException(message)`                              |
| `{ ok: false, type: "serverError" }`             | Let propagate → `InternalServerErrorException`                |
| Not found (implicit null check)                  | `new NotFoundException("Product not found")`                  |

### Image rollback flow preserved

```
validate files → upload to R2 (parallel) → withImageRollback(DB transaction)
                                         ↓
                              on failure: cleanupUploadedImages
                                         re-throw original exception
```

Post-commit R2 cleanup (update/delete): `Promise.allSettled` with logged errors, never aborts the response.

## 4.10 — `apps/nest/src/product/products.controller.ts`

9 routes — static keyword paths declared **before** `:id` to avoid param catching.

```ts
@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // ── Public GET routes ──────────────────────────────────────

  @Get()
  @AllowAnonymous()
  getAll(@Query() query: PaginationQueryDto):
    Promise<SuccessRes<ProductWithRelations[]>>

  @Get("featured")
  @AllowAnonymous()
  getFeatured():
    Promise<SuccessRes<ProductWithRelations | null>>

  @Get("latest")
  @AllowAnonymous()
  getLatest(@Query() query: LimitQueryDto):
    Promise<SuccessRes<ProductWithRelations[]>>

  @Get("trending")
  @AllowAnonymous()
  getTrending(@Query() query: LimitQueryDto):
    Promise<SuccessRes<ProductWithRelations[]>>

  @Get("shop")
  @AllowAnonymous()
  getShop(@Query() query: ShopQueryDto):
    Promise<SuccessRes<ProductWithRelations[]>>

  @Get("search")
  @AllowAnonymous()
  search(@Query() query: SearchQueryDto):
    Promise<SuccessRes<ProductWithRelations[]>>

  @Get(":id")
  @AllowAnonymous()
  getOne(@Param() param: UuidParamDto):
    Promise<SuccessRes<ProductWithRelations>>

  // ── Admin write routes ─────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor({
    storage: memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
  }))
  @UserHasPermission({ permission: { product: ["create", "update", "delete"] } })
  create(
    @Body() body: CreateProductDto,
    @UploadedFiles() files: MulterFile[],
    @Session() session: UserSession<typeof auth>,
  ): Promise<SuccessRes<ProductWithRelations>>

  @Put(":id")
  @UseInterceptors(AnyFilesInterceptor({
    storage: memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
  }))
  @UserHasPermission({ permission: { product: ["create", "update", "delete"] } })
  update(
    @Param() param: UuidParamDto,
    @Body() body: UpdateProductDto,
    @UploadedFiles() files: MulterFile[],
  ): Promise<SuccessRes<ProductWithRelations>>

  @Delete(":id")
  @UserHasPermission({ permission: { product: ["create", "update", "delete"] } })
  delete(@Param() param: UuidParamDto):
    Promise<SuccessRes<ProductWithRelations>>
}
```

Key details:

- Route ordering: `featured`, `latest`, `trending`, `shop`, `search` before `:id`
- Files via `@UploadedFiles()` return `[]` when no files uploaded
- `@Session()` provides `UserSession<typeof auth>` with `session.user.id` for creator
- All responses wrapped in `successResponse()`; paginated routes use `buildPagination()`
- `MulterFile` is a local interface: `{ buffer: Buffer; mimetype: string; originalname: string; size: number }`

## 4.11 — `apps/nest/src/product/products.module.ts`

```ts
import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
```

## 4.12 — Update `apps/nest/src/app.module.ts`

```diff
  imports: [
    HealthModule,
    AuthModule.forRoot({ auth, bodyParser: { rawBody: true } }),
    UserModule,
    CategoriesModule,
+   ProductsModule,
  ],
```

## 4.13 — Key design decisions

1. **DTOs accept raw form strings** — Multipart form-data sends everything as strings. JSON array fields (`sizes`, `colors`, `categoryIds`, `keepImageKeys`) are validated as `z.string()` in the DTO, then parsed + cross-field validated in the service. Keeps DTOs simple and avoids complex Zod 4 transforms.

2. **`memoryStorage()` for Multer** — Files stored in memory (`buffer`) for direct R2 upload. `limits.fileSize` rejects oversized files at the Multer boundary (returns 400 before reaching controller).

3. **Image validation at two levels** — Multer rejects files >512KB (400). Service validates type (500 for non-image MIME types). Image count (1–3) validated after separating kept vs new images.

4. **In-memory shop filtering** — Matches Hono's pattern: fetches all products, filters in-memory (category slug, price range, "new" flag), sorts, slices. Acceptable for small-to-medium catalog; can add DB-level filters later.

5. **Image rollback on DB failure** — `withImageRollback` deletes uploaded R2 images if the DB transaction throws, then re-throws the original exception (caught by global filter).

6. **Post-commit R2 cleanup** — After successful update/delete transaction, remove stale images from R2 via `Promise.allSettled` with logged failures (never aborts the HTTP response).

7. **Local `MulterFile` interface** — Avoids `@types/multer` dependency. Defines only the properties we use: `buffer`, `mimetype`, `originalname`, `size`.

## 4.14 — Route declaration order

Must match this order in the controller class (static keyword paths before `:id` param):

```
GET  /products           ← list (no suffix)
GET  /products/featured  ← static keyword
GET  /products/latest    ← static keyword
GET  /products/trending  ← static keyword
GET  /products/shop      ← static keyword
GET  /products/search    ← static keyword
GET  /products/:id       ← param catch-all (LAST among GETS)

POST /products
PUT  /products/:id
DELETE /products/:id
```

NestJS matches routes top-to-bottom, so `:id` must come after all static paths to avoid catching "featured" or "latest" as a UUID param.

## 4.15 — File summary

| File                     | Lines (est.) | Notes                                       |
| ------------------------ | ------------ | ------------------------------------------- |
| `lib/file.ts`            | ~30          | Port from Hono, adapted for Multer          |
| `lib/r2.ts`              | ~40          | Port from Hono, adapted buffer upload       |
| `lib/image-upload.ts`    | ~30          | Port from Hono, unchanged orchestration     |
| `products/types.ts`      | ~6           | Re-exported type aliases from validators    |
| `products/dto.ts`        | ~65          | 4 DTO classes (2 multipart, 2 query)        |
| `products/utils.ts`      | ~40          | JSON parsing + slug generation              |
| `products/service.ts`    | ~400         | All business logic + cross-field validation |
| `products/controller.ts` | ~130         | 9 routes with decorators                    |
| `products/module.ts`     | ~10          | Standard module                             |
| **Total**                | **~750**     | Across 9 new files + 1 edit                 |

## 4.16 — Open questions

1. **`bodyParser: false` + Multer** — Multer operates at the raw-request level, so this should work. Needs dev verification. Fallback: switch `bodyParser: true` and use `rawBody` middleware for Stripe.

2. **Shop query performance** — In-memory filtering loads all products. For small/medium catalogs this is fine. Consider adding DB-level `WHERE` clauses if the catalog grows.

3. **`@types/multer`** — Skipped in favor of a local `MulterFile` interface. If type errors arise during implementation, add `@types/multer` as dev dependency.

4. **Multer `memoryStorage()` import** — The `memoryStorage` function is exported from the `multer` package (bundled with `@nestjs/platform-express`). Verify the import path works with the project's module resolution.

## 4.17 — Frontend

No frontend changes expected — `apps/web` already consumes `{ data }` via `successResSchema()` and `{ error: { details } }` via `errorResSchema`. Product-specific frontend schemas are inferred from `@repo/db/validators/*` at build time.
