import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { cart, cartItem } from "../schemas/cart.schema";
import { ProductSelectSchema } from "./product.validator";

export const CartItemSelectSchema = createSelectSchema(cartItem).extend({
  createdAt: z.iso.datetime().transform((n) => new Date(n)),
  updatedAt: z.iso.datetime().transform((n) => new Date(n)),
  quantity: z.int().min(1),
});

export const CartSelectSchema = createSelectSchema(cart).extend({
  createdAt: z.iso.datetime().transform((n) => new Date(n)),
  updatedAt: z.iso.datetime().transform((n) => new Date(n)),
});

export const CartItemExtendedSchema = createSelectSchema(cartItem).extend({
  createdAt: z.iso.datetime().transform((n) => new Date(n)),
  updatedAt: z.iso.datetime().transform((n) => new Date(n)),
  product: ProductSelectSchema,
  cart: CartSelectSchema,
  quantity: z.int().min(1),
});

export const CartExtendedSchema = createSelectSchema(cart).extend({
  createdAt: z.iso.datetime().transform((n) => new Date(n)),
  updatedAt: z.iso.datetime().transform((n) => new Date(n)),
  cartItems: CartItemExtendedSchema.array(),
  totalItems: z.int().nonnegative(),
  totalAmount: z.string().regex(/^\d+(\.\d{2})?$/),
});

export const AddToCartSchema = createInsertSchema(cartItem, {
  quantity: z.int().min(1).default(1),
}).pick({
  productId: true,
  quantity: true,
});

export const UpdateCartItemSchema = createInsertSchema(cartItem, {
  quantity: z.int().min(1),
}).pick({
  quantity: true,
});
