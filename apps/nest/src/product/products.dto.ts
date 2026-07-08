import { createZodDto } from "nestjs-zod";
import { z } from "zod";

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

export class ShopQueryDto extends createZodDto(ShopQuerySchema) {}

export class CreateProductDto extends createZodDto(
  z.object({
    name: z.string().min(1),
    description: z.string().min(1).optional(),
    price: z
      .string()
      .min(1)
      .regex(/^\d+(\.\d{2})?$/),
    stockQuantity: z.string().min(1),
    sizes: z
      .string()
      .optional()
      .describe(
        `JSON stringified array of size objects, e.g. [{"name":"S","inStock":true}]`,
      ),
    colors: z
      .string()
      .optional()
      .describe(
        `JSON stringified array of color objects, e.g. [{"name":"Red","inStock":true}]`,
      ),
    categoryIds: z
      .string()
      .optional()
      .describe(
        `JSON stringified array of category ID strings, e.g. ["123e4567-e89b-12d3-a456-426614174000"]`,
      ),
  }),
) {}

export class UpdateProductDto extends createZodDto(
  z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    price: z
      .string()
      .min(1)
      .regex(/^\d+(\.\d{2})?$/)
      .optional(),
    stockQuantity: z.string().optional(),
    sizes: z
      .string()
      .optional()
      .describe(
        `JSON stringified array of size objects, e.g. [{"name":"S","inStock":true}]`,
      ),
    colors: z
      .string()
      .optional()
      .describe(
        `JSON stringified array of color objects, e.g. [{"name":"Red","inStock":true}]`,
      ),
    categoryIds: z
      .string()
      .optional()
      .describe(
        `JSON stringified array of category ID strings, e.g. ["123e4567-e89b-12d3-a456-426614174000"]`,
      ),
    keepImageKeys: z
      .string()
      .optional()
      .describe(`JSON array of image keys to keep`),
  }),
) {}
