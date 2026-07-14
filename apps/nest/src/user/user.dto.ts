import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import {
  ChangePasswordSchema,
  UserSelectSchema,
  UserUpdateSchema,
} from "@repo/db/validators/user.validator";

export class UpdateUserDto extends createZodDto(UserUpdateSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

// response dtos
export class UserDto extends createZodDto(UserSelectSchema) {}
export class ChangePasswordResponseDto extends createZodDto(
  z.object({ status: z.literal(true) }),
) {}
