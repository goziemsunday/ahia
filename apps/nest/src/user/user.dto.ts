import { createZodDto } from "nestjs-zod";

import {
  ChangePasswordSchema,
  UserUpdateSchema,
} from "@repo/db/validators/user.validator";

export class UpdateUserDto extends createZodDto(UserUpdateSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
