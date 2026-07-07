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
