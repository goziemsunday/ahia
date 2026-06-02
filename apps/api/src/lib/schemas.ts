import { z } from "zod";

// ── shared primitives ────────────────────────────────────────────────

/**
 * Reusable param schema for routes that take a UUID `:id` path parameter.
 */
export const UuidParamSchema = z.object({ id: z.uuid() });

/**
 * Reusable query schema for routes that accept an optional `limit` param
 * (e.g. "top N categories").
 * Distinct from `PaginationQuerySchema` which also includes `page`.
 */
export const LimitQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});

/**
 * InStock item shape, used for both sizes and colors variants.
 * Declared at file scope because it's referenced by the JSON-parse
 * transforms below and re-exported for use in OpenAPI docs.
 *
 * `InStockItem` is the TS type derived from this schema — the canonical
 * source of truth.
 */
export const InStockSchema = z.object({
  name: z.string().min(1, { error: "Name is required" }),
  inStock: z.boolean(),
});

export type InStockItem = z.infer<typeof InStockSchema>;

/**
 * Parse a JSON-stringified array field. If the raw value is undefined or
 * empty, returns an empty array. If the JSON is malformed or the parsed
 * value doesn't match the inner schema, the Zod `.refine` throws, and
 * hono-openapi's `validationHook` surfaces it as a 400 with the field path
 * in `fields`.
 */
const jsonArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return [] as z.infer<T>[];

      let parsed: unknown;
      try {
        parsed = JSON.parse(v);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: `${ctx.value || "value"} must be valid JSON`,
        });
        return z.NEVER;
      }

      const result = z.array(item).safeParse(parsed);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        ctx.addIssue({
          code: "custom",
          message: firstIssue
            ? `${ctx.value || "value"}: ${firstIssue.message}`
            : "Invalid array format",
        });
        return z.NEVER;
      }

      return result.data;
    });

// ── query schemas (unchanged) ───────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const ShopQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(50),
  cat: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  sort: z.enum(["newest", "price-asc", "price-desc"]).optional(),
  new: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().optional(),
});

// ── product form schemas ────────────────────────────────────────────

/**
 * Shape for `POST /api/products` form-data payload.
 *
 * `sizes`, `colors`, `categoryIds` are JSON-stringified on the wire
 * but parsed into native arrays here so downstream code never sees
 * raw strings. If a client sends malformed JSON or an array that
 * doesn't match the inner schema (e.g. `{name: 123}` instead of
 * `{name: "S", inStock: true}`), the Zod transform fails and
 * hono-openapi's validationHook surfaces a 400 with the field path.
 */
export const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  price: z
    .string()
    .min(1)
    .regex(/^\d+(\.\d{2})?$/),
  stockQuantity: z.string().min(1),
  sizes: jsonArray(InStockSchema).describe(
    `JSON stringified array of size objects, e.g. [{"name":"S","inStock":true}]`,
  ),
  colors: jsonArray(InStockSchema).describe(
    `JSON stringified array of color objects, e.g. [{"name":"Red","inStock":true}]`,
  ),
  categoryIds: jsonArray(z.uuid({ message: "Must be a valid UUID" })).describe(
    `JSON stringified array of category ID strings, e.g. ["123e4567-e89b-12d3-a456-426614174000"]`,
  ),
  images: z.union([z.any(), z.array(z.any())]).transform((val) => {
    if (val === undefined || val === null) return [];
    return Array.isArray(val) ? val : [val];
  }),
});

/**
 * Shape for `PUT /api/products/:id` form-data payload.
 *
 * All fields are optional. `keepImageKeys` is parsed from JSON like the
 * other array fields; the route defaults it to "all existing keys" when
 * the client omits the field entirely (handled in the validator, not
 * here).
 */
export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{2})?$/)
    .optional(),
  stockQuantity: z.string().optional(),
  sizes: jsonArray(InStockSchema).describe(
    `JSON stringified array of size objects, e.g. [{"name":"S","inStock":true}]`,
  ),
  colors: jsonArray(InStockSchema).describe(
    `JSON stringified array of color objects, e.g. [{"name":"Red","inStock":true}]`,
  ),
  categoryIds: jsonArray(z.uuid({ message: "Must be a valid UUID" })).describe(
    `JSON stringified array of category ID strings, e.g. ["123e4567-e89b-12d3-a456-426614174000"]`,
  ),
  keepImageKeys: jsonArray(z.string()).describe(
    `JSON array of image keys to keep`,
  ),
  newImages: z
    .union([z.any(), z.array(z.any())])
    .transform((val) => {
      if (val === undefined || val === null) return [];
      return Array.isArray(val) ? val : [val];
    })
    .optional(),
});
