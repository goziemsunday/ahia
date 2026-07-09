import { createZodDto } from "nestjs-zod";

import {
  AddToCartSchema,
  UpdateCartItemSchema,
} from "@repo/db/validators/cart.validator";

export class AddToCartDto extends createZodDto(AddToCartSchema) {}
export class UpdateCartItemDto extends createZodDto(UpdateCartItemSchema) {}
