import { db, eq, sql } from "@repo/db";
import { product } from "@repo/db/schemas/product.schema";

/**
 * Generate a random order number
 */
export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString().slice(2, 8).padStart(6, "0");
  return `ORD-${year}-${randomSuffix}`;
};

/**
 * Reserve stock for order items (decrement stock quantity)
 */
export const reserveStock = async (
  items: { productId: string; quantity: number }[],
) => {
  await Promise.all(
    items.map((item) =>
      db
        .update(product)
        .set({
          stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
        })
        .where(eq(product.id, item.productId)),
    ),
  );
};

/**
 * Restore stock for order items (increment stock quantity)
 */
export const restoreStock = async (
  items: { productId: string; quantity: number }[],
) => {
  await Promise.all(
    items.map((item) =>
      db
        .update(product)
        .set({
          stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
        })
        .where(eq(product.id, item.productId)),
    ),
  );
};
