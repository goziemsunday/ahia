import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { ListUsersQuerySchema } from "@repo/db/validators/admin.validator";
import { UserSelectSchema } from "@repo/db/validators/user.validator";

// request dtos
export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}
export class CreateUserBodyDto extends createZodDto(
  z.object({
    name: z.string().min(1),
    email: z.email(),
    role: z.enum(["user", "admin"]),
  }),
) {}

// response dtos
const WindowNumberSchema = z.object({
  "24h": z.number(),
  "7d": z.number(),
  "1m": z.number(),
});

const AdminStatsSchema = z.object({
  revenue: z.object({
    value: WindowNumberSchema,
    changePct: WindowNumberSchema,
  }),
  orders: z.object({
    value: WindowNumberSchema,
    changePct: WindowNumberSchema,
  }),
  products: z.object({
    value: z.object({ total: z.number() }),
    changePct: WindowNumberSchema,
  }),
  users: z.object({
    value: z.object({ total: z.number() }),
    change: WindowNumberSchema,
  }),
});

const MonthlyStatsSchema = z.object({
  month: z.string(),
  revenue: z.number(),
  orders: z.number(),
  products: z.number(),
  users: z.number(),
});

const AdminUsersListResponseSchema = z.object({
  users: z.array(UserSelectSchema),
  total: z.number(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export class AdminStatsDto extends createZodDto(AdminStatsSchema) {}
export class MonthlyStatsDto extends createZodDto(MonthlyStatsSchema) {}
export class AdminUsersListResponseDto extends createZodDto(
  AdminUsersListResponseSchema,
) {}
