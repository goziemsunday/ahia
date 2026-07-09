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

---

# Phase 5: Cart Module

## Goal

Port the 5 cart routes (all require auth) from the Hono API to NestJS. Cart follows the same service pattern as Categories/Products — single service class, NestJS exceptions, no discriminated union return types.

## 5.1 — New files

```
apps/nest/src/cart/
├── cart.controller.ts
├── cart.module.ts
├── cart.service.ts
├── cart.dto.ts
├── cart.types.ts
└── cart.utils.ts
```

## 5.2 — `cart.dto.ts`

```ts
import { createZodDto } from "nestjs-zod";
import {
  AddToCartSchema,
  UpdateCartItemSchema,
} from "@repo/db/validators/cart.validator";

export class AddToCartDto extends createZodDto(AddToCartSchema) {}
export class UpdateCartItemDto extends createZodDto(UpdateCartItemSchema) {}
```

## 5.3 — `cart.types.ts`

Type aliases inferred from `@repo/db/validators/cart.validator`:

```ts
import { z } from "zod";
import {
  CartSelectSchema,
  CartItemSelectSchema,
} from "@repo/db/validators/cart.validator";

export type CartItemResponse = z.infer<typeof CartItemSelectSchema>;
export type CartResponse = z.infer<typeof CartSelectSchema>;
```

## 5.4 — `cart.utils.ts`

Two pure functions ported from `apps/api/src/routes/cart/cart-helpers.ts`:

```ts
export interface CartItemInput { ... }
export interface CartInput { ... }
export type StockCheckResult = { ok: true } | { ok: false; errorMessage: string };

export const buildCartResponse = (cart: CartInput): CartResponse;
export const checkStockAvailability = (
  requestedQuantity: number,
  stockQuantity: number,
  existingQuantity?: number,
): StockCheckResult;
```

## 5.5 — `cart.service.ts`

`@Injectable()`, injects `ProductsService` for product existence + stock checks.

| Method                        | Transaction | Throws                                                           | Notes                                                                                                  |
| ----------------------------- | ----------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `getCart(userId)`             | —           | —                                                                | Get-or-create cart pattern. `buildCartResponse` with computed `subAmount`, `totalItems`, `totalAmount` |
| `addItem(userId, dto)`        | ✅          | `NotFoundException`, `BadRequestException`                       | Validate product exists (via `ProductsService.getOne`). Upsert on duplicate. Stock check. Tx.          |
| `updateItem(userId, id, dto)` | ✅          | `NotFoundException`, `ForbiddenException`, `BadRequestException` | Fetch cart item with details. Ownership check. Stock check on quantity increase. Tx.                   |
| `deleteItem(userId, id)`      | ✅          | `NotFoundException`, `ForbiddenException`                        | Fetch cart item with details. Ownership check. Tx. Return empty cart response after delete.            |
| `clearCart(userId)`           | ✅          | —                                                                | Get-or-create cart. Delete all items. Return empty cart response.                                      |

### Ownership check

```ts
const cartItem = await db.query.cartItem.findFirst({
  where: eq(cartItem.id, cartItemId),
  with: { cart: true, product: true },
});
if (!cartItem) throw new NotFoundException("Cart item not found");
if (cartItem.cart.userId !== userId)
  throw new ForbiddenException("You can only modify items in your own cart");
```

### Stock check (on add + update)

```ts
const product = await this.productsService.getOne(productId);
const existingItem = existingCart.cartItems.find(
  (i) => i.productId === productId,
);
const totalRequested = quantity + (existingItem?.quantity ?? 0);
const stockCheck = checkStockAvailability(
  totalRequested,
  product.stockQuantity ?? 0,
  existingItem?.quantity ?? 0,
);
if (!stockCheck.ok) throw new BadRequestException(stockCheck.errorMessage);
```

## 5.6 — `cart.controller.ts`

```ts
@Controller("cart")
export class CartController {
  constructor(private cartService: CartService) {}
}
```

5 routes, all require auth (no `@AllowAnonymous`). Uses `@UserHasPermission` already on main auth guard — cart routes just use the default session-authenticated state.

| Method   | Path              | DTO                 | Handler              |
| -------- | ----------------- | ------------------- | -------------------- |
| `GET`    | `/cart`           | —                   | `service.getCart`    |
| `POST`   | `/cart/items`     | `AddToCartDto`      | `service.addItem`    |
| `PUT`    | `/cart/items/:id` | `UpdateCartItemDto` | `service.updateItem` |
| `DELETE` | `/cart/items/:id` | — (UuidParamDto)    | `service.deleteItem` |
| `DELETE` | `/cart`           | —                   | `service.clearCart`  |

All return `SuccessRes<CartResponse>` via `successResponse()`.

## 5.7 — `cart.module.ts`

```ts
import { Module } from "@nestjs/common";
import { ProductsModule } from "../products/products.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  imports: [ProductsModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
```

Imports `ProductsModule` so `CartService` can inject `ProductsService` for product existence + stock checks.

## 5.8 — Update `apps/nest/src/app.module.ts`

```diff
+import { CartModule } from "./cart/cart.module";
...
  imports: [
    HealthModule,
    AuthModule.forRoot({ auth, bodyParser: { rawBody: true } }),
    UserModule,
    CategoriesModule,
    ProductsModule,
+   CartModule,
+   OrderModule,
+   WebhookModule,
  ],
```

---

# Phase 6: Orders Module

## Goal

Port the 4 order routes + Stripe webhook from the Hono API to NestJS. This is the most complex module — involves Stripe Checkout Session creation, manual webhook signature verification, stock reservation/restoration, and email notifications.

The order logic is split into two modules:

- **`OrderModule`** — user-facing endpoints (`/orders/*`) with auth
- **`WebhookModule`** — Stripe webhook endpoint (`/webhooks/stripe`) with no auth, configured for raw body access

## 6.1 — New files

```
apps/nest/src/order/
├── order.controller.ts
├── order.service.ts
├── order.module.ts
├── order.dto.ts
└── order.types.ts

apps/nest/src/webhook/
├── webhook.controller.ts
└── webhook.module.ts
```

No `lib/stripe.ts` needed — the NestJS app already has Stripe installed via the workspace. The Stripe client is instantiated in `order.service.ts` and `webhook.controller.ts` directly.

## 6.2 — `order.dto.ts`

```ts
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class VerifySessionDto extends createZodDto(
  z.object({ sessionId: z.string() }),
) {}
```

Only one DTO — `POST /orders/verify-session` takes a `sessionId` string. `POST /orders/create-checkout` takes no body. GET routes use `UuidParamDto` and `PaginationQueryDto` from shared DTOs.

## 6.3 — `order.types.ts`

Type aliases from `@repo/db/validators/order.validator`:

```ts
import { z } from "zod";
import {
  CreateCheckoutResponseSchema,
  OrderSelectSchema,
} from "@repo/db/validators/order.validator";

export type OrderWithItems = z.infer<typeof OrderSelectSchema>;
export type CheckoutResponse = z.infer<typeof CreateCheckoutResponseSchema>;
```

## 6.4 — `order.service.ts`

`@Injectable()`, injects `CartService` and `ProductsService`.

### Methods

| Method                               | Transaction | Throws                                                | Notes                                                                                                                                                                                           |
| ------------------------------------ | ----------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getUserOrders(userId, page, limit)` | —           | —                                                     | Paginated order history with items + products. Drizzle `findMany` with `where: eq(order.userId, userId)`, `with: { orderItems: { with: { product: true } } }`, `orderBy: desc(order.createdAt)` |
| `getOrderById(userId, orderId)`      | —           | `NotFoundException`                                   | Single order. Ownership check: `order.userId !== userId` → 404 (same as Hono — don't reveal existence of other users' orders)                                                                   |
| `createCheckout(userId, userEmail)`  | ✅          | `BadRequestException`, `UnprocessableEntityException` | See full flow below                                                                                                                                                                             |
| `verifySession(userId, sessionId)`   | ✅          | `NotFoundException`                                   | Retrieve Stripe session, check payment status, update order, clear cart, fire-and-forget receipt email                                                                                          |

### `createCheckout` flow

1. Fetch user's cart via `CartService.getCart()`
2. Validate cart is not empty → `BadRequestException`
3. Validate each cart item:
   - Product still exists (via `ProductsService.getOne`)
   - Sufficient stock → `UnprocessableEntityException` with INSUFFICIENT_STOCK or INVALID_CART_STATE
4. Calculate total amount from cart items
5. DB transaction:
   - Generate order number via `generateOrderNumber()` (ported from `order-queries.ts`)
   - Insert order row: `orderNumber, userId, email, totalAmount, status: "pending", paymentStatus: "pending"`
   - Insert order item rows: `orderId, productId, quantity, unitPrice, subTotal`
   - Reserve stock: `db.update(product).set({ stockQuantity: sql\`${product.stockQuantity} - ${item.quantity}\` })`
   - Create Stripe Checkout Session via `stripe.checkout.sessions.create()`
   - Update order with `stripeCheckoutSessionId`
6. Refetch order with relations
7. Return `CheckoutResponse`: `{ order, checkoutUrl, checkoutSessionId, stripePublishableKey }`

### `verifySession` flow

1. Retrieve Stripe session via `stripe.checkout.sessions.retrieve(sessionId)`
2. Look up order by `stripeCheckoutSessionId`
3. Ownership check: `order.userId !== userId` → 404
4. If order status is `pending` and session payment is `paid`:
   - Update order: `status: "completed"`, `paymentStatus: "paid"`, `paymentMethod`
   - Clear user's cart (via `CartService` or direct `db.delete`)
   - Fire-and-forget: send receipt email (call the ported email helper)
5. Return updated order

## 6.5 — `order.controller.ts`

```ts
@Controller("orders")
export class OrderController {
  constructor(private orderService: OrderService) {}
}
```

4 routes, all require auth (no `@AllowAnonymous`).

| Method | Path                      | DTO                  | Handler                  |
| ------ | ------------------------- | -------------------- | ------------------------ |
| `GET`  | `/orders`                 | `PaginationQueryDto` | `service.getUserOrders`  |
| `GET`  | `/orders/:id`             | `UuidParamDto`       | `service.getOrderById`   |
| `POST` | `/orders/create-checkout` | —                    | `service.createCheckout` |
| `POST` | `/orders/verify-session`  | `VerifySessionDto`   | `service.verifySession`  |

All return `SuccessRes<OrderWithItems>` or `SuccessRes<CheckoutResponse>` via `successResponse()`.

## 6.6 — `order.module.ts`

```ts
import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module";
import { ProductsModule } from "../product/products.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [CartModule, ProductsModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
```

## 6.7 — `webhook.controller.ts`

No `@AllowAnonymous` — no auth guards at all. Uses `@Req() req: Request` to access `req.rawBody` and the `stripe-signature` header.

### Endpoint

| Method | Path               | Auth            | Handler         |
| ------ | ------------------ | --------------- | --------------- |
| `POST` | `/webhooks/stripe` | None (raw body) | `handleWebhook` |

### `handleWebhook` flow

1. Extract `stripe-signature` header → 400 if missing
2. Read `req.rawBody` (set by `AuthModule.forRoot({ bodyParser: { rawBody: true } })`)
3. Manual signature verification (port `verifyAndParseWebhook` from Hono's `stripe.route.ts`):
   - Parse `t=TIMESTAMP,v1=SIG` header format
   - Check timestamp within 300s tolerance
   - Compute `HMAC-SHA256("timestamp.body", webhookSecret)`
   - Constant-time comparison against `v1` signatures
4. Route by event type:
   - `checkout.session.completed` → update order to `completed`/`paid`, clear cart, fire-and-forget receipt email
   - `checkout.session.expired` → update order to `cancelled`/`failed`, restore stock
   - `checkout.session.async_payment_failed` → same as expired
5. Return `{ received: true }` with 200

No `@Controller("webhooks")` — set `@Controller()` with empty prefix, then mount manually at `/api/webhooks/stripe` via `app.use()` or configure a custom route in `main.ts`. This avoids global prefix interference.

## 6.8 — `webhook.module.ts`

```ts
import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";

@Module({
  controllers: [WebhookController],
})
export class WebhookModule {}
```

## 6.9 — Update `main.ts` for webhook route

The global prefix `/api` applies to all controllers. The webhook controller needs to sit outside the default routing. Two approaches:

**Approach A** (Recommended): Use a custom route path in the controller that includes the full path:

```ts
@Controller("api/webhooks/stripe")
export class WebhookController {
  @Post()
  async handleWebhook(@Req() req: Request) { ... }
}
```

This works with the existing `setGlobalPrefix("api")` — the full path becomes `/api/api/webhooks/stripe` → **wrong**.

**Approach B**: Set `globalPrefixOptions: { exclude: ['webhooks'] }` and give the controller a relative path:

```ts
// main.ts
app.setGlobalPrefix("api", { exclude: [{ path: 'webhooks/stripe', method: RequestMethod.POST }] });

// webhook.controller.ts
@Controller("webhooks/stripe")
export class WebhookController { ... }
```

This gives `/webhooks/stripe` — correct, no extra prefix. **But note**: the `ZodValidationPipe` and `ZodSerializerInterceptor` from `AppModule` won't apply to this controller either (since it's excluded from global prefix, and those providers use different mechanisms — they apply globally regardless). Actually, the global pipes/filters/interceptors apply to all controllers regardless of prefix exclusion. So this is the right approach.

## 6.10 — Stock helpers (in `order.service.ts`)

Two pure functions ported from `order-queries.ts` — inlined as private methods:

```ts
private generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString().slice(2, 8).padStart(6, "0");
  return `ORD-${year}-${randomSuffix}`;
}

private async reserveStock(items: { productId: string; quantity: number }[]): Promise<void> {
  await Promise.all(
    items.map((item) =>
      db.update(product)
        .set({ stockQuantity: sql`${product.stockQuantity} - ${item.quantity}` })
        .where(eq(product.id, item.productId)),
    ),
  );
}

private async restoreStock(items: { productId: string; quantity: number }[]): Promise<void> {
  // Same as reserveStock but with + instead of -
}
```

`restoreStock` is used in the webhook controller for expired/failed payments — it can be a utility function exported from `order.service.ts` or defined directly in the webhook controller.

Since the webhook controller doesn't inject `OrderService` (it's a standalone flow), `restoreStock` should live in a shared util or be duplicated in the webhook controller.

## 6.11 — Stripe client

Instantiated in each file that needs it (same pattern as Hono):

```ts
import Stripe from "stripe";
import env from "../lib/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});
```

This can be a shared export from `order.service.ts` and imported in `webhook.controller.ts`, or defined in a `lib/stripe.ts`.

## 6.12 — Update `apps/nest/src/app.module.ts`

```diff
+import { OrderModule } from "./order/order.module";
+import { WebhookModule } from "./webhook/webhook.module";

  imports: [
    HealthModule,
    AuthModule.forRoot({ auth, bodyParser: { rawBody: true } }),
    UserModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
+   OrderModule,
+   WebhookModule,
  ],
```

## 6.13 — Type distribution

| File             | Types                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `order.types.ts` | `OrderWithItems` (from `OrderSelectSchema`), `CheckoutResponse` (from `CreateCheckoutResponseSchema`) |
| Controller       | Returns `SuccessRes<OrderWithItems>` or `SuccessRes<CheckoutResponse>`                                |
| Service          | Returns `OrderWithItems`, `CheckoutResponse`, or `{ orders: OrderWithItems[]; total: number }`        |
| Webhook          | No custom types — uses raw DB row types inline                                                        |

## 6.14 — Error mapping

| Hono                                                            | NestJS                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `{ type: "emptyCart" }` → 400                                   | `BadRequestException("Cart is empty...")`                     |
| `{ type: "validationError", code: "INSUFFICIENT_STOCK" }` → 422 | `UnprocessableEntityException("Not enough stock...")`         |
| `{ type: "validationError", code: "INVALID_CART_STATE" }` → 422 | `UnprocessableEntityException("Product no longer exists...")` |
| Order not found → 404                                           | `NotFoundException("Order not found")`                        |
| Unauthorized → 401                                              | Handled by `@thallesp/nestjs-better-auth`                     |
| Ownership mismatch → 404                                        | `NotFoundException("Order not found")`                        |
| Server error → 500                                              | Let propagate → global `HttpExceptionFilter`                  |

---

# Phase 7: Admin Module

## Goal

Port the 7 admin dashboard routes (stats, users, orders) from the Hono API to NestJS. Admin uses existing NestJS services for aggregate data where possible, and the Better Auth admin API for user CRUD.

## 7.1 — New files

```
apps/nest/src/admin/
├── admin.controller.ts    ← 7 routes, class-level @UserHasPermission
├── admin.service.ts       ← orchestrates calls to extended services + DB
├── admin.module.ts        ← imports OrdersModule, ProductsModule
├── admin.dto.ts           ← DTOs from @repo/db/validators/admin.validator
└── admin.types.ts         ← StatsOverview, MonthlyStats types
```

## 7.2 — `admin.dto.ts`

Reuses existing Zod schemas from `@repo/db/validators/admin.validator` plus shared DTOs:

```ts
import { createZodDto } from "nestjs-zod";
import { ListUsersQuerySchema } from "@repo/db/validators/admin.validator";

export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}

// CreateUserDto — TBD (schema defined when POST /users is implemented)
```

For `POST /admin/users`, the DTO will be added when the route is implemented (per user preference). The remaining routes use `UuidParamDto` and `PaginationQueryDto` from shared DTOs.

## 7.3 — `admin.types.ts`

```ts
export interface StatsOverview {
  products: number;
  revenue: {
    last24h: { amount: number; count: number };
    last7d: { amount: number; count: number };
    last30d: { amount: number; count: number };
  };
  totalOrders: number;
  totalUsers: number;
}

export interface MonthlyStat {
  month: string;       // "2024-01"
  revenue: number;
  orders: number;
}
```

## 7.4 — Extensions to existing services

### `OrdersService` — add 4 methods

```ts
// Admin overview stats: revenue + order count for 3 time windows
async getOrderStats(): Promise<{
  last24h: { amount: number; count: number };
  last7d: { amount: number; count: number };
  last30d: { amount: number; count: number };
}>;

// Monthly aggregation for the last 12 months
async getMonthlyStats(): Promise<{ month: string; revenue: number; orders: number }[]>;

// Paginated list of all orders (admin view with customer info)
async getAllOrders(page?: number, limit?: number): Promise<{
  orders: OrderWithItems[];
  total: number;
}>;

// Single order by ID with customer info
async getOneOrder(id: string): Promise<OrderWithItems>;
```

Implementation notes:
- `getOrderStats()` — three `db.select({ count: count(), amount: sum(order.totalAmount) }).from(order).where(...)` queries with different time windows (`gte(order.createdAt, now - interval '24 hours')`, etc.)
- `getMonthlyStats()` — `db.select({ month: sql<string>\`to_char(created_at, 'YYYY-MM')\`, revenue: sum(order.totalAmount), orders: count() }).from(order).groupBy(sql\`1\`).orderBy(sql\`1\`).limit(12)` — aggregates by month, last 12 months
- `getAllOrders()` — `db.query.order.findMany()` with `with: { user: true, orderItems: { with: { product: true } } }`, pagination, `orderBy: desc(order.createdAt)`
- `getOneOrder()` — `db.query.order.findFirst()` with same relations as `getAllOrders`, throws `NotFoundException` if missing

### `ProductsService` — add 1 method

```ts
async getCount(): Promise<number>;
```

Implementation:
```ts
async getCount(): Promise<number> {
  const result = await db.select({ count: count() }).from(product);
  return result[0].count;
}
```

## 7.5 — `admin.service.ts`

```ts
@Injectable()
export class AdminService {
  constructor(
    private ordersService: OrdersService,
    private productsService: ProductsService,
  ) {}

  // Uses extended OrdersService and ProductsService, plus raw DB for user count
}
```

| Method | Data source | Notes |
|---|---|---|
| `getStats()` | `OrdersService.getOrderStats()`, `ProductsService.getCount()`, raw `db.select({ count: count() }).from(user)` | User count from raw DB (no UserService exists) |
| `getMonthlyStats()` | `OrdersService.getMonthlyStats()` | Passthrough to OrdersService |
| `getUsers(query)` | `AuthService.api.listUsers()` via Better Auth admin plugin | Paginated, with name/email filters |
| `getUserById(id)` | `AuthService.api.getUser()` via Better Auth admin plugin | Single user |
| `getOrders(page, limit)` | `OrdersService.getAllOrders()` | Passthrough |
| `getOrderById(id)` | `OrdersService.getOneOrder()` | Passthrough |
| `createUser(body)` | `AuthService.api.createUser()` | TBD — implement when needed |

The service keeps the orchestration thin — most logic lives in the respective domain services. Stats combines 3 calls in parallel:

```ts
async getStats(): Promise<StatsOverview> {
  const [orderStats, productCount, userCountResult] = await Promise.all([
    this.ordersService.getOrderStats(),
    this.productsService.getCount(),
    db.select({ count: count() }).from(user),
  ]);

  return {
    products: productCount,
    revenue: orderStats,
    totalOrders: orderStats.last24h.count + orderStats.last7d.count + orderStats.last30d.count,
    totalUsers: userCountResult[0].count,
  };
}
```

## 7.6 — `admin.controller.ts`

```ts
@Controller("admin")
@UserHasPermission({
  permission: { user: ["list"], order: ["view-user", "view-all"] },
})
export class AdminController {
  constructor(private adminService: AdminService) {}
}
```

Class-level `@UserHasPermission` applies the minimum permissions to all 7 routes. The `POST /users` route layers an additional `@UserHasPermission({ permission: { user: ["create"] } })`.

| Method | Path | DTO | Extra auth | Handler |
|---|---|---|---|---|
| `GET` | `/admin/stats` | — | — | `service.getStats()` |
| `GET` | `/admin/stats/monthly` | — | — | `service.getMonthlyStats()` |
| `GET` | `/admin/users` | `ListUsersQueryDto` | — | `service.getUsers(query)` |
| `GET` | `/admin/users/:id` | `UuidParamDto` | — | `service.getUserById(id)` |
| `POST` | `/admin/users` | *TBD* | `+ @UserHasPermission({ permission: { user: ["create"] } })` | `service.createUser(body)` |
| `GET` | `/admin/orders` | `PaginationQueryDto` | — | `service.getOrders(page, limit)` |
| `GET` | `/admin/orders/:id` | `UuidParamDto` | — | `service.getOrderById(id)` |

All return `SuccessRes<T>` via `successResponse()`. Paginated routes use `buildPagination()`.

## 7.7 — `admin.module.ts`

```ts
import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { ProductsModule } from "../product/products.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [OrdersModule, ProductsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

Imports `OrdersModule` and `ProductsModule` so `AdminService` can inject `OrdersService` and `ProductsService` (both must export their services).

## 7.8 — Update `apps/nest/src/app.module.ts`

```diff
+import { AdminModule } from "./admin/admin.module";

  imports: [
    HealthModule,
    AuthModule.forRoot({ auth, bodyParser: { rawBody: true } }),
    UserModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrderModule,
    WebhookModule,
+   AdminModule,
  ],
```

## 7.9 — File summary

| File | Lines (est.) | Notes |
|---|---|---|
| `admin/dto.ts` | ~10 | Reuses `ListUsersQuerySchema` from validators |
| `admin/types.ts` | ~15 | `StatsOverview`, `MonthlyStat` interfaces |
| `admin/service.ts` | ~70 | Orchestration, parallel calls, passthroughs |
| `admin/controller.ts` | ~80 | 7 routes, class-level + one method-level decorator |
| `admin/module.ts` | ~10 | Standard module, imports Orders + Products |
| **Service additions** | | |
| `orders/orders.service.ts` | +60 | 4 new methods (stats, monthly, admin listing) |
| `product/products.service.ts` | +6 | 1 new method (`getCount`) |
| **Total new** | **~185** | |

## 7.10 — Module export requirements

For `AdminModule` to inject `OrdersService` and `ProductsService`:

- `OrdersModule` must have `exports: [OrdersService]` ✅
- `ProductsModule` must have `exports: [ProductsService]` ⚠️ — needs to be added
- `CategoriesModule` must have `exports: [CategoriesService]` ⚠️ — needed by `ProductsService` (already injected there)

These are NestJS DI requirements — a provider must be exported by its module to be available to modules that import it.

## 7.11 — Error mapping

| Hono | NestJS |
|---|---|
| `{ error: { details } }` → 404 (user/order not found) | `NotFoundException` |
| `{ error: { details } }` → 409 (duplicate) | `ConflictException` |
| Unauthorized → 401 | Handled by `@thallesp/nestjs-better-auth` |
| Forbidden (insufficient permissions) → 403 | Handled by `@UserHasPermission` |
