import { createZodDto } from "nestjs-zod";

import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from "@repo/db/validators/product.validator";

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
