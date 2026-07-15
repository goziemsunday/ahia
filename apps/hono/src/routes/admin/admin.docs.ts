import { describeRoute } from "hono-openapi";
import { z } from "zod";

import { WindowNumberSchema } from "@repo/db/validators/admin.validator";
import { OrderWithCustomerSelectSchema } from "@repo/db/validators/order.validator";
import { UserSelectSchema } from "@repo/db/validators/user.validator";

import HttpStatusCodes from "@/lib/http-status-codes";
import {
  createErrorResponse,
  createGenericErrorResponse,
  createRateLimitErrorResponse,
  createServerErrorResponse,
  createSuccessResponse,
  getErrDetailsFromErrFields,
} from "@/lib/openapi";
import {
  adminExamples,
  authExamples,
  miscExamples,
} from "@/lib/openapi-examples";

const tags = ["Admin"];

export const getAdminStatsDoc = describeRoute({
  description: "Get admin overview stats",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Admin stats retrieved", {
      details: "Admin stats retrieved successfully",
      dataSchema: z.object({
        revenue: z.object({
          value: WindowNumberSchema,
          changePct: WindowNumberSchema,
        }),
        orders: z.object({
          value: WindowNumberSchema,
          changePct: WindowNumberSchema,
        }),
        products: z.object({
          value: z.object({
            total: z.number().int().nonnegative(),
          }),
          changePct: WindowNumberSchema,
        }),
        users: z.object({
          value: z.object({
            total: z.number().int().nonnegative(),
          }),
          change: WindowNumberSchema,
        }),
      }),
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "User does not have the required permission",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

const MonthlyStatsEntrySchema = z.object({
  month: z.string(),
  revenue: z.number(),
  orders: z.number(),
  products: z.number(),
  users: z.number(),
});

export const getAdminMonthlyStatsDoc = describeRoute({
  description: "Get monthly aggregated stats for the last 12 months",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Monthly stats retrieved", {
      details: "Monthly stats retrieved successfully",
      dataSchema: z.array(MonthlyStatsEntrySchema),
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "User does not have the required permission",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getAllUsersDoc = describeRoute({
  description: "Get all users (admin only)",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Users retrieved", {
      details: "Users retrieved successfully",
      dataSchema: z.object({
        users: z.array(UserSelectSchema),
        total: z.number().int().nonnegative(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      }),
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(adminExamples.getUsersValErrs),
        fields: adminExamples.getUsersValErrs,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "User does not have the required permission",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getUserDoc = describeRoute({
  description: "Get a user by id (admin only)",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("User retrieved", {
      details: "User retrieved successfully",
      dataSchema: UserSelectSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidUUID: {
        summary: "Invalid user ID",
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
      details: "User does not have the required permission",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse("User not found", {
      code: "NOT_FOUND",
      details: "User not found",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getAdminOrdersDoc = describeRoute({
  description: "Get all orders (admin only)",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "Orders retrieved",
      {
        details: "Orders retrieved successfully",
        dataSchema: z.array(OrderWithCustomerSelectSchema),
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
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "User does not have the required permission",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getAdminOrderDoc = describeRoute({
  description: "Get order by ID (admin only)",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Order retrieved", {
      details: "Order retrieved successfully",
      dataSchema: OrderWithCustomerSelectSchema,
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
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "User does not have the required permission",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse("Order not found", {
      code: "NOT_FOUND",
      details: "Order not found",
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const createUserDoc = describeRoute({
  description: "Create a new user account (admin only)",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.CREATED]: createSuccessResponse("User created", {
      details: "User created successfully",
      dataSchema: UserSelectSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(adminExamples.createUserValErrs),
        fields: adminExamples.createUserValErrs,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "User does not have the required permission",
    }),
    [HttpStatusCodes.CONFLICT]: createGenericErrorResponse(
      "User already exists",
      {
        code: "CONFLICT",
        details: "A user with this email already exists",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});
