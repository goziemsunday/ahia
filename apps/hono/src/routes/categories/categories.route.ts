import { validator } from "hono-openapi";

import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from "@repo/db/validators/product.validator";

import { createRouter } from "@/app";
import HttpStatusCodes from "@/lib/http-status-codes";
import {
  LimitQuerySchema,
  PaginationQuerySchema,
  UuidParamSchema,
} from "@/lib/schemas";
import { buildPagination, errorResponse, successResponse } from "@/lib/utils";
import { authed } from "@/middleware/authed";
import { permit } from "@/middleware/permit";
import { validationHook } from "@/middleware/validation-hook";
import {
  getCategories,
  getCategoryById,
  getTopCategories,
} from "@/queries/category-queries";
import { getTopCategoriesDoc } from "@/routes/categories/categories.docs";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/services/category-service";

import {
  createCategoryDoc,
  deleteCategoryDoc,
  getAllCategoriesDoc,
  getCategoryDoc,
  updateCategoryDoc,
} from "./categories.docs";

const categories = createRouter();

// Get all categories
categories.get(
  "/",
  getAllCategoriesDoc,
  validator("query", PaginationQuerySchema, validationHook),
  async (c) => {
    try {
      const { page, limit } = c.req.valid("query");

      const { categories: allCategories, total } = await getCategories(
        page,
        limit,
      );

      // Use the shared helper instead of manually computing
      // `Math.ceil(total / limit)` and building the object inline.
      const pagination = buildPagination(page, limit, total);

      return c.json(
        successResponse(
          allCategories,
          "All categories retrieved successfully",
          pagination,
        ),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error retrieving categories:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve categories"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Get top categories by product count
categories.get(
  "/top",
  getTopCategoriesDoc,
  validator("query", LimitQuerySchema, validationHook),
  async (c) => {
    const { limit } = c.req.valid("query");
    const topCats = await getTopCategories(limit ?? 4);

    return c.json(
      successResponse(topCats, "Top categories retrieved successfully"),
      HttpStatusCodes.OK,
    );
  },
);

// Get category by ID
categories.get(
  "/:id",
  getCategoryDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");

    try {
      const categoryWithProducts = await getCategoryById(id);

      if (!categoryWithProducts) {
        return c.json(
          errorResponse("NOT_FOUND", "Category not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      return c.json(
        successResponse(
          categoryWithProducts,
          "Category retrieved successfully",
        ),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error retrieving category:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve category"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Middleware for protected routes
categories
  .use(authed)
  .use(permit({ category: ["create", "update", "delete"] }));

// Create category
categories.post(
  "/",
  createCategoryDoc,
  validator("json", CreateCategorySchema, validationHook),
  async (c) => {
    const categoryData = c.req.valid("json");

    const result = await createCategory(categoryData.name);

    if (!result.ok) {
      if (result.type === "conflict") {
        return c.json(
          errorResponse("CONFLICT", result.message),
          HttpStatusCodes.CONFLICT,
        );
      }
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", result.message),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      successResponse(result.data, "Category created successfully"),
      HttpStatusCodes.CREATED,
    );
  },
);

// Update category
categories.put(
  "/:id",
  updateCategoryDoc,
  validator("param", UuidParamSchema, validationHook),
  validator("json", UpdateCategorySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const categoryData = c.req.valid("json");

    if (!categoryData.name) {
      return c.json(
        successResponse(
          await getCategoryById(id),
          "Category updated successfully",
        ),
        HttpStatusCodes.OK,
      );
    }

    const result = await updateCategory(id, categoryData.name);

    if (!result.ok) {
      if (result.type === "notFound") {
        return c.json(
          errorResponse("NOT_FOUND", result.message),
          HttpStatusCodes.NOT_FOUND,
        );
      }
      if (result.type === "conflict") {
        return c.json(
          errorResponse("CONFLICT", result.message),
          HttpStatusCodes.CONFLICT,
        );
      }
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", result.message),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      successResponse(result.data, "Category updated successfully"),
      HttpStatusCodes.OK,
    );
  },
);

// Delete category
categories.delete(
  "/:id",
  deleteCategoryDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");

    const result = await deleteCategory(id);

    if (!result.ok) {
      if (result.type === "notFound") {
        return c.json(
          errorResponse("NOT_FOUND", result.message),
          HttpStatusCodes.NOT_FOUND,
        );
      }
      if (result.type === "hasProducts") {
        return c.json(
          errorResponse("CONFLICT", result.message),
          HttpStatusCodes.CONFLICT,
        );
      }
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", result.message),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      successResponse(result.data, "Category deleted successfully"),
      HttpStatusCodes.OK,
    );
  },
);

export default categories;
