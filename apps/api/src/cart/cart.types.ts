import { cart, cartItem } from "@repo/db/schemas/cart.schema";
import { product } from "@repo/db/schemas/product.schema";

export type CartRow = typeof cart.$inferSelect;
export type CartItemRow = typeof cartItem.$inferSelect;

export type CartItemResponse = {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  subAmount: string;
  product: typeof product.$inferSelect;
  createdAt: Date;
  updatedAt: Date;
};

export type CartResponse = {
  id: string;
  userId: string;
  cartItems: CartItemResponse[];
  totalItems: number;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CartItemWithDetails = {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  cart: CartRow;
  product: typeof product.$inferSelect;
  createdAt: Date;
  updatedAt: Date;
};

export type CartItemWithProduct = {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  product: typeof product.$inferSelect;
  createdAt: Date;
  updatedAt: Date;
};

export type CartWithItems = {
  id: string;
  userId: string;
  cartItems: CartItemWithProduct[];
  createdAt: Date;
  updatedAt: Date;
};
