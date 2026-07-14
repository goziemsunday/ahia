import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import {
  AddToCartSchema,
  UpdateCartItemSchema,
} from "@repo/db/validators/cart.validator";
import { ProductSelectSchema } from "@repo/db/validators/product.validator";

// request dtos
export class AddToCartDto extends createZodDto(AddToCartSchema) {}
export class UpdateCartItemDto extends createZodDto(UpdateCartItemSchema) {}

// response dtos
const CartItemResponseSchema = z.object({
  id: z.string(),
  cartId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  subAmount: z.string(),
  product: ProductSelectSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CartResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  cartItems: CartItemResponseSchema.array(),
  totalItems: z.number().int().nonnegative(),
  totalAmount: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class CartItemResponseDto extends createZodDto(CartItemResponseSchema) {}
export class CartResponseDto extends createZodDto(CartResponseSchema) {}
