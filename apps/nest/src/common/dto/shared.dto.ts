import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class UuidParamDto extends createZodDto(z.object({ id: z.uuid() })) {}

export class LimitQueryDto extends createZodDto(
  z.object({
    limit: z.coerce.number().int().positive().optional(),
  }),
) {}

export class PaginationQueryDto extends createZodDto(
  z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
) {}

export class SearchQueryDto extends createZodDto(
  z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().positive().optional(),
  }),
) {}
