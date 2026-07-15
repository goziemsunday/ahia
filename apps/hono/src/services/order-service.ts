import { db, eq } from "@repo/db";
import { order } from "@repo/db/schemas/order.schema";

import env from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { getUserCartWithItems } from "@/queries/cart-queries";
import {
  createOrder,
  createOrderItems,
  getOrderById,
  reserveStock,
} from "@/queries/order-queries";

/**
 * Discriminated union for checkout operation results. The route handler
 * maps each variant to an HTTP status mechanically.
 */
export type CheckoutResult =
  | {
      ok: true;
      data: { order: unknown; checkoutUrl: string; checkoutSessionId: string };
    }
  | { ok: false; type: "emptyCart"; message: string }
  | { ok: false; type: "validationError"; code: string; message: string }
  | { ok: false; type: "serverError"; message: string };

/**
 * Validate a single cart item for checkout. Returns a validation error
 * if the product no longer exists or if the requested quantity exceeds
 * available stock. Returns `null` on success.
 */
const validateCartItem = (cartItem: {
  productId: string;
  quantity: number;
  product: {
    name: string;
    price: string;
    stockQuantity: number | null;
  } | null;
}): { code: string; details: string } | null => {
  if (!cartItem.product) {
    return {
      code: "INVALID_CART_STATE",
      details: `Product with ID "${cartItem.productId}" no longer exists`,
    };
  }

  const availableStock = cartItem.product.stockQuantity || 0;
  if (cartItem.quantity > availableStock) {
    return {
      code: "INSUFFICIENT_STOCK",
      details: `Not enough stock for "${cartItem.product.name}". Requested: ${cartItem.quantity}, Available: ${availableStock}`,
    };
  }

  return null;
};

/**
 * Create a checkout session for the user's cart. Validates all cart
 * items, creates the order + order items in a transaction, reserves
 * stock, creates a Stripe checkout session, and returns the checkout URL.
 */
export const createCheckout = async (
  userId: string,
  userEmail: string,
): Promise<CheckoutResult> => {
  try {
    // ── 1. fetch cart ──────────────────────────────────────────────
    const userCart = await getUserCartWithItems(userId);

    if (!userCart || userCart.cartItems.length === 0) {
      return {
        ok: false,
        type: "emptyCart",
        message: "Cart is empty. Add items to cart before creating order.",
      };
    }

    // ── 2. validate items + calculate total ────────────────────────
    const validationErrors: { code: string; details: string }[] = [];
    let totalAmount = 0;

    for (const cartItem of userCart.cartItems) {
      const error = validateCartItem(cartItem);
      if (error) {
        validationErrors.push(error);
        continue;
      }
      // Safe to cast: validateCartItem returned null, so product is non-null.
      totalAmount +=
        parseFloat((cartItem.product as { price: string }).price) *
        cartItem.quantity;
    }

    if (validationErrors.length > 0) {
      return {
        ok: false,
        type: "validationError",
        code: validationErrors[0].code,
        message: validationErrors[0].details,
      };
    }

    // ── 3. create order + reserve stock + Stripe session ───────────
    const result = await db.transaction(async () => {
      const newOrder = await createOrder(
        userId,
        userEmail,
        totalAmount.toFixed(2),
      );

      // Create order items with frozen prices
      await createOrderItems(
        newOrder.id,
        userCart.cartItems.map((cartItem) => ({
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          unitPrice: (cartItem.product as { price: string }).price,
        })),
      );

      // Reserve stock immediately
      await reserveStock(
        userCart.cartItems.map((cartItem) => ({
          productId: cartItem.productId,
          quantity: cartItem.quantity,
        })),
      );

      // Create Stripe Checkout Session
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: userCart.cartItems.map((cartItem) => {
          const product = cartItem.product as {
            name: string;
            description: string | null;
            price: string;
            images: { url: string }[];
          };
          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: product.name,
                description: product.description || undefined,
                images: product.images
                  .map((img) => img.url)
                  .filter((url): url is string => Boolean(url)),
              },
              unit_amount: Math.round(parseFloat(product.price) * 100),
            },
            quantity: cartItem.quantity,
          };
        }),
        mode: "payment",
        success_url: `${env.WEB_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.WEB_URL}/checkout/cancel`,
        customer_email: userEmail,
        client_reference_id: newOrder.id,
        metadata: {
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          userId,
        },
        shipping_address_collection: {
          allowed_countries: ["US", "CA", "GB", "AU", "NG", "GH"],
        },
        billing_address_collection: "required",
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      });

      // Update order with Stripe session ID
      await db
        .update(order)
        .set({ stripeCheckoutSessionId: checkoutSession.id })
        .where(eq(order.id, newOrder.id));

      return { order: newOrder, checkoutSession };
    });

    // ── 4. fetch complete order with relations ─────────────────────
    const orderWithItems = await getOrderById(result.order.id);

    if (!orderWithItems) {
      return {
        ok: false,
        type: "serverError",
        message: "Failed to retrieve created order",
      };
    }

    return {
      ok: true,
      data: {
        order: orderWithItems,
        checkoutUrl: result.checkoutSession.url!,
        checkoutSessionId: result.checkoutSession.id,
      },
    };
  } catch (err) {
    console.error("Error creating checkout:", err);
    return {
      ok: false,
      type: "serverError",
      message: "Failed to create order",
    };
  }
};
