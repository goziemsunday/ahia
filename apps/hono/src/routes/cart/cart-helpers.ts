/**
 * Raw cart item shape returned by the cart query functions. Each item
 * includes the full product relation for price/stock lookups.
 */
interface CartItemInput {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  product: { price: string; [key: string]: unknown };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw cart shape returned by the cart query functions. The `cartItems`
 * array contains the product relation needed for subtotal calculation.
 */
interface CartInput {
  id: string;
  userId: string;
  cartItems: CartItemInput[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The enriched cart item returned to the client. Adds `subAmount` —
 * the line total formatted to 2 decimal places — which the raw DB
 * row doesn't include.
 */
export interface CartItemResponse {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  subAmount: string;
  product: CartItemInput["product"];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The full cart response sent to the client. Adds computed `totalItems`
 * and `totalAmount` fields that the raw DB row doesn't include.
 */
export interface CartResponse {
  id: string;
  userId: string;
  cartItems: CartItemResponse[];
  totalItems: number;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Build the client-facing cart response from a raw cart row. Computes
 * per-item subtotals (`price × quantity`) and accumulates the cart-level
 * `totalItems` and `totalAmount`.
 */
export const buildCartResponse = (cart: CartInput): CartResponse => {
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

/**
 * Result of a stock availability check. The caller maps this into
 * the appropriate HTTP response — the helper itself is pure and
 * knows nothing about Hono or status codes.
 */
export type StockCheckResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

/**
 * Check whether `requestedQuantity` of a product can be fulfilled
 * given the current stock and what's already in the cart.
 *
 * The add-to-cart handler needs to account for the quantity already
 * in the cart (you can't add 5 more if you already have 3 and only
 * 6 are in stock). The update handler just compares the new total
 * against stock. Both cases are covered by passing the effective
 * "already in cart" count as `existingQuantity`.
 */
export const checkStockAvailability = (
  requestedQuantity: number,
  stockQuantity: number,
  existingQuantity: number = 0,
): StockCheckResult => {
  if (requestedQuantity > stockQuantity) {
    if (stockQuantity === 0) {
      return {
        ok: false,
        errorMessage: "Product is currently out of stock. Available: 0",
      };
    }
    const maxCanAdd = stockQuantity - existingQuantity;
    return {
      ok: false,
      errorMessage: `Not enough stock available. Requested: ${requestedQuantity}, Available: ${stockQuantity}. Maximum you can add: ${maxCanAdd}`,
    };
  }
  return { ok: true };
};
