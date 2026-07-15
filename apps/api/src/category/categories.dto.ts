import { createZodDto } from "nestjs-zod";

import {
  CategoryExtendedSchema,
  CategorySelectSchema,
  CategoryWithCountSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
} from "@repo/db/validators/product.validator";

// request dtos
export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}

// response dtos
export class CategoryDto extends createZodDto(CategorySelectSchema) {}
export class CategoryWithCountDto extends createZodDto(
  CategoryWithCountSchema,
) {}
export class CategoryWithProductDto extends createZodDto(
  CategoryExtendedSchema,
) {}
