import { CartResponse, CartWithItems } from "./cart.types";

/**
 * Build the client-facing cart response from a raw cart row. Computes
 * per-item subtotals (`price × quantity`) and accumulates the cart-level
 * `totalItems` and `totalAmount`.
 */
export const buildCartResponse = (cart: CartWithItems): CartResponse => {
  let totalItems = 0;
  let totalAmount = 0;

  const cartItemsWithSubtotals = cart.cartItems.map((item) => {
    const subAmount = (parseFloat(item.product.price) * item.quantity).toFixed(
      2,
    );
    totalItems += item.quantity;
    totalAmount += parseFloat(subAmount);

    return {
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      quantity: item.quantity,
      subAmount,
      product: item.product,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  return {
    id: cart.id,
    userId: cart.userId,
    cartItems: cartItemsWithSubtotals,
    totalItems,
    totalAmount: totalAmount.toFixed(2),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
};
