import { z } from "zod";

import { ProductSelectSchema } from "@repo/db/validators/product.validator";

const CartItemWithProductSchema = z.object({
  id: z.string(),
  cartId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  subAmount: z.string(),
  product: ProductSelectSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CartResponseDataSchema = z.object({
  id: z.string(),
  userId: z.string(),
  cartItems: CartItemWithProductSchema.array(),
  totalItems: z.number().int().nonnegative(),
  totalAmount: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
