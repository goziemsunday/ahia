import { describeRoute } from "hono-openapi";
import { z } from "zod";

import { ProductExtendedSchema } from "@repo/db/validators/product.validator";

import { ALLOWED_FILE_TYPES } from "@/lib/file";
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
  miscExamples,
  productsExamples,
} from "@/lib/openapi-examples";

const tags = ["Products"];

export const getAllProductsDoc = describeRoute({
  description: "Get all products",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "All products retrieved",
      {
        details: "All products retrieved successfully",
        dataSchema: z.array(ProductExtendedSchema),
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

export const getFeaturedProductDoc = describeRoute({
  description: "Get the featured product",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "Featured product retrieved",
      {
        details: "Featured product retrieved successfully",
        dataSchema: ProductExtendedSchema,
      },
      true,
    ),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Featured product not found",
      {
        code: "NOT_FOUND",
        details: "No featured product available",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getLatestProductsDoc = describeRoute({
  description: "Get the latest products",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "Latest products retrieved",
      {
        details: "Latest products retrieved successfully",
        dataSchema: z.array(ProductExtendedSchema),
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

export const getTrendingProductsDoc = describeRoute({
  description: "Get trending products ranked by units sold in the last 30 days",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "Trending products retrieved",
      {
        details: "Trending products retrieved successfully",
        dataSchema: z.array(ProductExtendedSchema),
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

export const getShopProductsDoc = describeRoute({
  description:
    "Get products for the shop page with filtering, sorting, and pagination",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse(
      "Shop products retrieved",
      {
        details: "Shop products retrieved successfully",
        dataSchema: z.array(ProductExtendedSchema),
      },
      true,
    ),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(productsExamples.getShopValErrs),
        fields: productsExamples.getShopValErrs,
      },
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const searchProductsDoc = describeRoute({
  description: "Search products by name",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Search results retrieved", {
      details: "Search results retrieved successfully",
      dataSchema: z.array(ProductExtendedSchema),
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid request data",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(
          productsExamples.searchProductValErrs,
        ),
        fields: productsExamples.searchProductValErrs,
      },
    }),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const getProductDoc = describeRoute({
  description: "Get a product",
  tags,
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Product retrieved", {
      details: "Product retrieved successfully",
      dataSchema: ProductExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidUUID: {
        summary: "Invalid product ID",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(authExamples.uuidValErr),
        fields: authExamples.uuidValErr,
      },
    }),
    [HttpStatusCodes.NOT_FOUND]: createGenericErrorResponse(
      "Product not found",
      {
        code: "NOT_FOUND",
        details: "Product not found",
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const createProductDoc = describeRoute({
  description: "Create a new product",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.CREATED]: createSuccessResponse("Product created", {
      details: "Product created successfully",
      dataSchema: ProductExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid service token",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(
          productsExamples.createProductValErrs,
        ),
        fields: productsExamples.createProductValErrs,
      },
      categoryNotFound: {
        summary: "Category not found",
        code: "INVALID_DATA",
        details: "One or more categories not found",
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
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: createErrorResponse(
      "Invalid file data",
      {
        notAnArray: {
          summary: "Not an array",
          code: "INVALID_FILE",
          details: "Images must be an array",
        },
        noImages: {
          summary: "No images provided",
          code: "INVALID_FILE",
          details: "At least 1 image is required",
        },
        tooManyImages: {
          summary: "Too many images",
          code: "INVALID_FILE",
          details: "Maximum 3 images allowed",
        },
        fileFormatError: {
          summary: "Invalid file format",
          code: "INVALID_FILE",
          details: "Image 1: Invalid file format",
        },
        fileSizeError: {
          summary: "File size too large",
          code: "INVALID_FILE",
          details: "Image 1: File size must be less than 512KB",
        },
        fileTypeError: {
          summary: "Invalid file type",
          code: "INVALID_FILE",
          details: `Image 1: File type must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
        },
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const updateProductDoc = describeRoute({
  description: "Update an existing product",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Product updated", {
      details: "Product updated successfully",
      dataSchema: ProductExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      validationError: {
        summary: "Invalid service token",
        code: "INVALID_DATA",
        details: getErrDetailsFromErrFields(
          productsExamples.createProductValErrs,
        ),
        fields: productsExamples.createProductValErrs,
      },
      categoryNotFound: {
        summary: "Category not found",
        code: "INVALID_DATA",
        details: "One or more categories not found",
      },
      invalidImageKey: {
        summary: "Invalid image key",
        code: "INVALID_DATA",
        details:
          "Invalid image key: 'invalid-key' doesn't exist in this product",
        fields: {
          keepImageKeys:
            "Invalid image key: 'invalid-key' doesn't exist in this product",
        },
      },
      invalidUUID: {
        summary: "Invalid product ID",
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
      "Product not found",
      {
        code: "NOT_FOUND",
        details: "Product not found",
      },
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: createErrorResponse(
      "Invalid file data",
      {
        noImages: {
          summary: "No images after update",
          code: "INVALID_FILE",
          details: "Product must have at least 1 image",
        },
        tooManyImages: {
          summary: "Too many images",
          code: "INVALID_FILE",
          details: "Maximum 3 images allowed",
        },
        fileSizeError: {
          summary: "File size too large",
          code: "INVALID_FILE",
          details: "Image 1: File size must be less than 512KB",
        },
        fileTypeError: {
          summary: "Invalid file type",
          code: "INVALID_FILE",
          details: `Image 1: File type must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
        },
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});

export const deleteProductDoc = describeRoute({
  description: "Delete a product",
  tags,
  security: [
    {
      Bearer: [],
    },
  ],
  responses: {
    [HttpStatusCodes.OK]: createSuccessResponse("Product deleted", {
      details: "Product deleted successfully",
      dataSchema: ProductExtendedSchema,
    }),
    [HttpStatusCodes.BAD_REQUEST]: createErrorResponse("Invalid request data", {
      invalidUUID: {
        summary: "Invalid product ID",
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
      "Product not found",
      {
        code: "NOT_FOUND",
        details: "Product not found",
      },
    ),
    [HttpStatusCodes.CONFLICT]: createErrorResponse(
      "Product has dependencies",
      {
        hasCartItems: {
          summary: "Product in carts",
          code: "CONFLICT",
          details: "Product cannot be deleted as it exists in user carts",
        },
        hasOrderItems: {
          summary: "Product in orders",
          code: "CONFLICT",
          details: "Product cannot be deleted as it exists in orders",
        },
        hasBothDependencies: {
          summary: "Product in carts and orders",
          code: "CONFLICT",
          details: "Product cannot be deleted as it exists in carts and orders",
        },
      },
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: createRateLimitErrorResponse(),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: createServerErrorResponse(),
  },
});
