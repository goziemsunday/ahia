import { validator } from "hono-openapi";
import { z } from "zod";

import { createRouter } from "@/app";
import { sendOrderReceiptEmail } from "@/lib/email";
import env from "@/lib/env";
import HttpStatusCodes from "@/lib/http-status-codes";
import { PaginationQuerySchema, UuidParamSchema } from "@/lib/schemas";
import { stripe } from "@/lib/stripe";
import { buildPagination, errorResponse, successResponse } from "@/lib/utils";
import { authed } from "@/middleware/authed";
import { validationHook } from "@/middleware/validation-hook";
import { clearCartItemsByUserId } from "@/queries/cart-queries";
import {
  getOrderById,
  getOrderByStripeSessionId,
  getUserOrders,
  updateOrderStatus,
} from "@/queries/order-queries";
import { createCheckout } from "@/services/order-service";

import {
  createCheckoutDoc,
  getUserOrderDoc,
  getUserOrdersDoc,
  verifySessionDoc,
} from "./orders.docs";

const orders = createRouter().use(authed);

// Get user's order history
orders.get(
  "/",
  getUserOrdersDoc,
  validator("query", PaginationQuerySchema, validationHook),
  async (c) => {
    const user = c.get("user");

    try {
      const { page, limit } = c.req.valid("query");
      const { orders: userOrders, total } = await getUserOrders(
        user.id,
        page,
        limit,
      );

      const pagination = buildPagination(page, limit, total);

      return c.json(
        successResponse(
          userOrders,
          "User orders retrieved successfully",
          pagination,
        ),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error retrieving user orders:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve orders"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Get user's order details
orders.get(
  "/:id",
  getUserOrderDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");

    try {
      const orderWithItems = await getOrderById(id);

      if (!orderWithItems || orderWithItems.userId !== user.id) {
        return c.json(
          errorResponse("NOT_FOUND", "Order not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      return c.json(
        successResponse(orderWithItems, "Order details retrieved successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error retrieving order details:", error);
      return c.json(
        errorResponse(
          "INTERNAL_SERVER_ERROR",
          "Failed to retrieve order details",
        ),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Verify checkout session and update order status
orders.post(
  "/verify-session",
  verifySessionDoc,
  validator("json", z.object({ sessionId: z.string() }), validationHook),
  async (c) => {
    const user = c.get("user");
    const { sessionId } = c.req.valid("json");

    try {
      // Retrieve the session from Stripe to get the real payment status
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session) {
        return c.json(
          errorResponse("NOT_FOUND", "Checkout session not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      // Find the order by stripe session ID
      const existingOrder = await getOrderByStripeSessionId(sessionId);

      if (!existingOrder || existingOrder.userId !== user.id) {
        return c.json(
          errorResponse("NOT_FOUND", "Order not found for this session"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      // Only update if order is still pending
      if (
        existingOrder.status === "pending" &&
        session.payment_status === "paid"
      ) {
        await updateOrderStatus(
          existingOrder.id,
          "completed",
          "paid",
          session.payment_method_types?.[0] || "card",
        );

        // Clear cart
        await clearCartItemsByUserId(user.id);

        // Send receipt email
        const orderWithReceipt = await getOrderById(existingOrder.id);
        if (orderWithReceipt) {
          sendOrderReceiptEmail(orderWithReceipt, user.name).catch((err) => {
            console.error(
              "[Verify Session] Failed to send receipt email:",
              err,
            );
          });
        }

        console.log(
          `[Verify Session] Order ${existingOrder.orderNumber} marked as paid`,
        );
      }

      // Return the updated order
      const updatedOrder = await getOrderById(existingOrder.id);

      return c.json(
        successResponse(updatedOrder, "Session verified successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error verifying checkout session:", error);
      return c.json(
        errorResponse(
          "INTERNAL_SERVER_ERROR",
          "Failed to verify checkout session",
        ),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Create checkout
orders.post("/create-checkout", createCheckoutDoc, async (c) => {
  const user = c.get("user");

  const result = await createCheckout(user.id, user.email);

  if (!result.ok) {
    if (result.type === "emptyCart") {
      return c.json(
        errorResponse("INVALID_DATA", result.message),
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    if (result.type === "validationError") {
      return c.json(
        errorResponse(result.code, result.message),
        HttpStatusCodes.UNPROCESSABLE_ENTITY,
      );
    }
    return c.json(
      errorResponse("INTERNAL_SERVER_ERROR", result.message),
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  const checkoutResponse = {
    order: result.data.order,
    checkoutUrl: result.data.checkoutUrl,
    checkoutSessionId: result.data.checkoutSessionId,
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY,
  };

  return c.json(
    successResponse(checkoutResponse, "Order created successfully"),
    HttpStatusCodes.OK,
  );
});

export default orders;
