import { describeRoute } from "hono-openapi";
import { z } from "zod";

import {
  CategoryExtendedSchema,
  CategorySelectSchema,
  CategoryWithCountSchema,
} from "@repo/db/validators/product.validator";

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
  authExamples,
  categoriesExamples,
  miscExamples,
} from "@/lib/openapi-examples";

const tags = ["Categories"];

export const getAllCategoriesDoc = describeRoute({
  description: "Get all categories",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "All categories retrieved",
      {
        details: "All categories retrieved successfully",
        dataSchema: z.array(CategoryWithCountSchema),
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
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getTopCategoriesDoc = describeRoute({
  description: "Get top categories by product count",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "Top categories retrieved",
      {
        details: "Top categories retrieved successfully",
        dataSchema: z.array(CategoryWithCountSchema),
      },
      true,
    ),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields({
          limit: miscExamples.paginationValErrs.limit,
        }),
        fields: {
          limit: miscExamples.paginationValErrs.limit,
        },
      },
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getCategoryDoc = describeRoute({
  description: "Get a category with its products",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Category retrieved", {
      details: "Category retrieved successfully",
      dataSchema: CategoryExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidUUID: {
        summary: "Invalid category ID",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(authExamples.uuidValErr),
        fields: authExamples.uuidValErr,
      },
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Category not found",
      {
        code: "NOT_FOUND",
        details: "Category not found",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const createCategoryDoc = describeRoute({
  description: "Create a new category",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.CREATED]: createSuccessResponse("Category created", {
      details: "Category created successfully",
      dataSchema: CategorySelectSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(
          categoriesExamples.createCategoryValErrs,
        ),
        fields: categoriesExamples.createCategoryValErrs,
      },
    }),
    [HttpStatusCodes.UNAUTHORIZED]: createGenericErrorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      details: "No session found",
    }),
    [HttpStatusCodes.FORBIDDEN]: createGenericErrorResponse("Forbidden", {
      code: "FORBIDDEN",
      details: "User does not have the required role",
    }),
    [HttpStatusCodes.CONFLICT]: createGenericErrorResponse(
      "Category name already exists",
      {
        code: "CONFLICT",
        details: "Category name already exists",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const updateCategoryDoc = describeRoute({
  description: "Update a category",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Category updated", {
      details: "Category updated successfully",
      dataSchema: CategorySelectSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(
          categoriesExamples.createCategoryValErrs,
        ),
        fields: categoriesExamples.createCategoryValErrs,
      },
      invalidUUID: {
        summary: "Invalid category ID",
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
      details: "User does not have the required role",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Category not found",
      {
        code: "NOT_FOUND",
        details: "Category not found",
      },
    ),
    [HttpStatusCodes.CONFLICT]: createGenericErrorResponse(
      "Category name already exists",
      {
        code: "CONFLICT",
        details: "Category name already exists",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const deleteCategoryDoc = describeRoute({
  description: "Delete a category",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Category deleted", {
      details: "Category deleted successfully",
      dataSchema: CategorySelectSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidUUID: {
        summary: "Invalid category ID",
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
      details: "User does not have the required role",
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Category not found",
      {
        code: "NOT_FOUND",
        details: "Category not found",
      },
    ),
    [HttpStatusCodes.CONFLICT]: createGenericErrorResponse(
      "Category has associated products",
      {
        code: "CONFLICT",
        details: "Category has associated products",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});
