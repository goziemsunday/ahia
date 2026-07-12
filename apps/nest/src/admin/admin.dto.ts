import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { ListUsersQuerySchema } from "@repo/db/validators/admin.validator";

export class ListUsersQueryDto extends createZodDto(ListUsersQuerySchema) {}
export class CreateUserBodyDto extends createZodDto(
  z.object({
    name: z.string().min(1),
    email: z.email(),
    role: z.enum(["user", "admin"]),
  }),
) {}
