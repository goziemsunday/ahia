import { describeRoute } from "hono-openapi";

import { CartExtendedSchema } from "@repo/db/validators/cart.validator";

import HttpStatusCodes from "@/lib/http-status-codes";
import {
  createErrorResponse,
  createGenericErrorResponse,
  createRateLimitErrorResponse,
  createServerErrorResponse,
  createSuccessResponse,
  getErrDetailsFromErrFields,
} from "@/lib/openapi";
import { authExamples, cartExamples } from "@/lib/openapi-examples";

const tags = ["Cart"];

export const getUserCartDoc = describeRoute({
  description: "Get user's cart",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Cart retrieved", {
      details: "Cart retrieved successfully",
      dataSchema: CartExtendedSchema,
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const addToCartDoc = describeRoute({
  description: "Add product to cart",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Product added to cart", {
      details: "Product added to cart successfully",
      dataSchema: CartExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(cartExamples.addToCartValErrs),
        fields: cartExamples.addToCartValErrs,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Product not found",
      {
        code: "NOT_FOUND",
        details: "Product not found",
      },
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: createErrorResponse(
      "Insufficient stock",
      {
        insufficientStock: {
          summary: "Not enough stock",
          code: "INSUFFICIENT_STOCK",
          details:
            "Not enough stock available. Requested: 5, Available: 3. Maximum you can add: 3",
        },
        outOfStock: {
          summary: "Product out of stock",
          code: "INSUFFICIENT_STOCK",
          details: "Product is currently out of stock. Available: 0",
        },
        existingCartItem: {
          summary: "Insufficient stock with existing cart item",
          code: "INSUFFICIENT_STOCK",
          details:
            "Not enough stock available. You have 2 in cart, requested 5 more, but only 4 available total. Maximum you can add: 2",
        },
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const updateCartItemDoc = describeRoute({
  description: "Update cart item quantity",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Cart item updated", {
      details: "Cart item updated successfully",
      dataSchema: CartExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(cartExamples.updateCartItemValErrs),
        fields: cartExamples.updateCartItemValErrs,
      },
      invalidUUID: {
        summary: "Invalid cart item ID",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(authExamples.uuidValErr),
        fields: authExamples.uuidValErr,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "You can only update items in your own cart",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Cart item not found",
      {
        code: "NOT_FOUND",
        details: "Cart item not found",
      },
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: createErrorResponse(
      "Insufficient stock",
      {
        insufficientStock: {
          summary: "Not enough stock",
          code: "INSUFFICIENT_STOCK",
          details:
            "Not enough stock available. Requested: 10, Available: 7. Maximum quantity: 7",
        },
        outOfStock: {
          summary: "Product out of stock",
          code: "INSUFFICIENT_STOCK",
          details: "Product is currently out of stock. Available: 0",
        },
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const deleteCartItemDoc = describeRoute({
  description: "Delete cart item",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Cart item deleted", {
      details: "Cart item removed successfully",
      dataSchema: CartExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidUUID: {
        summary: "Invalid cart item ID",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(authExamples.uuidValErr),
        fields: authExamples.uuidValErr,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "You can only remove items from your own cart",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Cart item not found",
      {
        code: "NOT_FOUND",
        details: "Cart item not found",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const clearCartDoc = describeRoute({
  description: "Clear all items from cart",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Cart cleared", {
      details: "Cart cleared successfully",
      dataSchema: CartExtendedSchema,
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});
