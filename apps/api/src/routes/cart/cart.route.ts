import { validator } from "hono-openapi";

import { db } from "@repo/db";
import {
  AddToCartSchema,
  UpdateCartItemSchema,
} from "@repo/db/validators/cart.validator";

import { createRouter } from "@/app";
import HttpStatusCodes from "@/lib/http-status-codes";
import { UuidParamSchema } from "@/lib/schemas";
import { errorResponse, successResponse } from "@/lib/utils";
import { authed } from "@/middleware/authed";
import { validationHook } from "@/middleware/validation-hook";
import {
  addCartItem,
  clearCartItems,
  deleteCartItem,
  getCartItem,
  getCartItemWithDetails,
  getOrCreateUserCart,
  getUserCartWithItems,
  updateCartItemQuantity,
} from "@/queries/cart-queries";
import { getProductById } from "@/queries/product-queries";

import { buildCartResponse, checkStockAvailability } from "./cart-helpers";
import {
  addToCartDoc,
  clearCartDoc,
  deleteCartItemDoc,
  getUserCartDoc,
  updateCartItemDoc,
} from "./cart.docs";

const cart = createRouter().use(authed);

// Get user's cart
cart.get("/", getUserCartDoc, async (c) => {
  const user = c.get("user");

  try {
    const userCart = await getOrCreateUserCart(user.id);

    if (!userCart) {
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve cart"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    const cartResponse = buildCartResponse(userCart);

    return c.json(
      successResponse(cartResponse, "Cart retrieved successfully"),
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error("Error retrieving user cart:", error);
    return c.json(
      errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve cart"),
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
});

// Add to cart
cart.post(
  "/items",
  addToCartDoc,
  validator("json", AddToCartSchema, validationHook),
  async (c) => {
    const user = c.get("user");
    const { productId, quantity } = c.req.valid("json");

    try {
      // Validate product exists and get current stock
      const product = await getProductById(productId);

      if (!product) {
        return c.json(
          errorResponse("NOT_FOUND", "Product not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      // Get or create user cart
      const userCart = await getOrCreateUserCart(user.id);
      if (!userCart) {
        return c.json(
          errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve cart"),
          HttpStatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      // Check if product already in cart
      const existingCartItem = await getCartItem(userCart.id, productId);

      const totalRequestedQuantity =
        quantity + (existingCartItem?.quantity ?? 0);

      const stockCheck = checkStockAvailability(
        totalRequestedQuantity,
        product.stockQuantity || 0,
        existingCartItem?.quantity ?? 0,
      );

      if (!stockCheck.ok) {
        return c.json(
          errorResponse("INSUFFICIENT_STOCK", stockCheck.errorMessage),
          HttpStatusCodes.UNPROCESSABLE_ENTITY,
        );
      }

      // Add/update cart item in transaction
      await db.transaction(async () => {
        if (existingCartItem) {
          await updateCartItemQuantity(
            existingCartItem.id,
            totalRequestedQuantity,
          );
        } else {
          await addCartItem(userCart.id, productId, quantity);
        }
      });

      const updatedCart = await getUserCartWithItems(user.id);

      if (!updatedCart) {
        return c.json(
          errorResponse(
            "INTERNAL_SERVER_ERROR",
            "Failed to retrieve updated cart",
          ),
          HttpStatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      // Use the shared helper instead of inline map/reduce.
      const cartResponse = buildCartResponse(updatedCart);

      return c.json(
        successResponse(cartResponse, "Product added to cart successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error adding product to cart:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to add product to cart"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Update cart item quantity
cart.put(
  "/items/:id",
  updateCartItemDoc,
  validator("param", UuidParamSchema, validationHook),
  validator("json", UpdateCartItemSchema, validationHook),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const { quantity } = c.req.valid("json");

    try {
      // Get cart item with cart and product details
      const cartItemWithDetails = await getCartItemWithDetails(id);

      if (!cartItemWithDetails) {
        return c.json(
          errorResponse("NOT_FOUND", "Cart item not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      // Verify ownership - cart item belongs to user's cart
      if (cartItemWithDetails.cart.userId !== user.id) {
        return c.json(
          errorResponse(
            "FORBIDDEN",
            "You can only update items in your own cart",
          ),
          HttpStatusCodes.FORBIDDEN,
        );
      }

      // Validate stock availability (only if quantity is increasing)
      if (quantity > cartItemWithDetails.quantity) {
        const stockCheck = checkStockAvailability(
          quantity,
          cartItemWithDetails.product.stockQuantity || 0,
        );

        if (!stockCheck.ok) {
          return c.json(
            errorResponse("INSUFFICIENT_STOCK", stockCheck.errorMessage),
            HttpStatusCodes.UNPROCESSABLE_ENTITY,
          );
        }
      }

      // Update cart item quantity in transaction
      await db.transaction(async () => {
        await updateCartItemQuantity(id, quantity);
      });

      // Fetch updated cart with all relations and calculations
      const updatedCart = await getUserCartWithItems(user.id);
      if (!updatedCart) {
        return c.json(
          errorResponse(
            "INTERNAL_SERVER_ERROR",
            "Failed to retrieve updated cart",
          ),
          HttpStatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      const cartResponse = buildCartResponse(updatedCart);

      return c.json(
        successResponse(cartResponse, "Cart item updated successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error updating cart item:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to update cart item"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Delete cart item
cart.delete(
  "/items/:id",
  deleteCartItemDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    try {
      // Get cart item with cart details for ownership validation
      const cartItemWithDetails = await getCartItemWithDetails(id);

      if (!cartItemWithDetails) {
        return c.json(
          errorResponse("NOT_FOUND", "Cart item not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      // Verify ownership - cart item belongs to user's cart
      if (cartItemWithDetails.cart.userId !== user.id) {
        return c.json(
          errorResponse(
            "FORBIDDEN",
            "You can only remove items from your own cart",
          ),
          HttpStatusCodes.FORBIDDEN,
        );
      }

      // Delete cart item in transaction
      await db.transaction(async () => {
        await deleteCartItem(id);
      });

      // Fetch updated cart with all relations and calculations
      const updatedCart = await getUserCartWithItems(user.id);
      if (!updatedCart) {
        return c.json(
          errorResponse(
            "INTERNAL_SERVER_ERROR",
            "Failed to retrieve updated cart",
          ),
          HttpStatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      const cartResponse = buildCartResponse(updatedCart);

      return c.json(
        successResponse(cartResponse, "Cart item removed successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error removing cart item:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to remove cart item"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Clear cart
cart.delete("/", clearCartDoc, async (c) => {
  const user = c.get("user");

  try {
    // Get or create user cart
    const userCart = await getOrCreateUserCart(user.id);

    if (!userCart) {
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve cart"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    // Clear all cart items in transaction
    await db.transaction(async () => {
      await clearCartItems(userCart.id);
    });

    // Return empty cart structure
    const emptyCartResponse = {
      id: userCart.id,
      userId: userCart.userId,
      cartItems: [],
      totalItems: 0,
      totalAmount: "0.00",
      createdAt: userCart.createdAt,
      updatedAt: userCart.updatedAt,
    };

    return c.json(
      successResponse(emptyCartResponse, "Cart cleared successfully"),
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error("Error clearing cart:", error);
    return c.json(
      errorResponse("INTERNAL_SERVER_ERROR", "Failed to clear cart"),
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
});

export default cart;
