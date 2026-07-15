import { describeRoute } from "hono-openapi";
import { z } from "zod";

import {
  CreateCheckoutResponseSchema,
  OrderSelectSchema,
} from "@repo/db/validators/order.validator";

import HttpStatusCodes from "@/lib/http-status-codes";
import {
  createErrorResponse,
  createGenericErrorResponse,
  createRateLimitErrorResponse,
  createServerErrorResponse,
  createSuccessResponse,
  getErrDetailsFromErrFields,
} from "@/lib/openapi";
import { authExamples, miscExamples } from "@/lib/openapi-examples";

const tags = ["Orders"];

export const getUserOrdersDoc = describeRoute({
  description: "Get user's order history",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "User orders retrieved",
      {
        details: "User orders retrieved successfully",
        dataSchema: z.array(OrderSelectSchema),
      },
      true,
    ),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(miscExamples.paginationValErrs),
        fields: miscExamples.paginationValErrs,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getUserOrderDoc = describeRoute({
  description: "Get user's order details",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Order details retrieved", {
      details: "Order details retrieved successfully",
      dataSchema: OrderSelectSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidUUID: {
        summary: "Invalid order ID",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(authExamples.uuidValErr),
        fields: authExamples.uuidValErr,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse("Order not found", {
      code: "NOT_FOUND",
      details: "Order not found",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const verifySessionDoc = describeRoute({
  description: "Verify a Stripe checkout session and update order status",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Session verified", {
      details: "Session verified successfully",
      dataSchema: OrderSelectSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidSessionId: {
        summary: "Invalid session ID",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields({
          sessionId: authExamples.uuidValErr.id,
        }),
        fields: {
          sessionId: authExamples.uuidValErr.id,
        },
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse("Not found", {
      code: "NOT_FOUND",
      details: "Order not found for this session",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const createCheckoutDoc = describeRoute({
  description: "Create order",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Order created successfully", {
      details: "Order created successfully",
      dataSchema: CreateCheckoutResponseSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      emptyCart: {
        summary: "Empty cart",
        code: "INVALID_DATA",
        details: "Cart is empty. Add items to cart before creating order.",
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: createErrorResponse(
      "Cart or stock issues",
      {
        insufficientStock: {
          summary: "Insufficient stock",
          code: "INSUFFICIENT_STOCK",
          details: `Not enough stock for "Product". Requested: 5, Available: 3`,
        },
        productNoLongerExists: {
          summary: "Product no longer exists",
          code: "INVALID_CART_STATE",
          details:
            'Product with ID "123e4567-e89b-12d3-a456-426614174000" no longer exists',
        },
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});
