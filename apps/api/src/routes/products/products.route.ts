import { validator } from "hono-openapi";

import { createRouter } from "@/app";
import HttpStatusCodes from "@/lib/http-status-codes";
import { getErrDetailsFromErrFields } from "@/lib/openapi";
import {
  CreateProductSchema,
  LimitQuerySchema,
  PaginationQuerySchema,
  SearchQuerySchema,
  ShopQuerySchema,
  UpdateProductSchema,
  UuidParamSchema,
} from "@/lib/schemas";
import { buildPagination, errorResponse, successResponse } from "@/lib/utils";
import { authed } from "@/middleware/authed";
import { permit } from "@/middleware/permit";
import { validationHook } from "@/middleware/validation-hook";
import {
  getFeaturedProduct,
  getLatestProducts,
  getProductById,
  getProducts,
  getShopProducts,
  getTrendingProducts,
  searchProducts,
} from "@/queries/product-queries";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/services/product-service";

import {
  createProductDoc,
  deleteProductDoc,
  getAllProductsDoc,
  getFeaturedProductDoc,
  getLatestProductsDoc,
  getProductDoc,
  getShopProductsDoc,
  getTrendingProductsDoc,
  searchProductsDoc,
  updateProductDoc,
} from "./products.docs";

const products = createRouter();

// ── read-only routes (no auth required) ────────────────────────────

// Get all products (paginated)
products.get(
  "/",
  getAllProductsDoc,
  validator("query", PaginationQuerySchema, validationHook),
  async (c) => {
    const { page, limit } = c.req.valid("query");
    const { products: allProducts, total } = await getProducts(page, limit);

    // Use the shared helper instead of the inline ternary with
    // `Math.ceil(total / limit)`.
    const pagination = buildPagination(page, limit, total);

    return c.json(
      successResponse(
        allProducts,
        "All products retrieved successfully",
        pagination,
      ),
      HttpStatusCodes.OK,
    );
  },
);

// Get featured product (daily rotation)
products.get("/featured", getFeaturedProductDoc, async (c) => {
  const featured = await getFeaturedProduct();
  if (!featured) {
    return c.json(
      errorResponse("NOT_FOUND", "No featured product available"),
      HttpStatusCodes.NOT_FOUND,
    );
  }
  return c.json(
    successResponse(featured, "Featured product retrieved successfully"),
    HttpStatusCodes.OK,
  );
});

// Get latest products
products.get(
  "/latest",
  getLatestProductsDoc,
  validator("query", LimitQuerySchema, validationHook),
  async (c) => {
    const { limit } = c.req.valid("query");
    const latest = await getLatestProducts(limit ?? 4);
    return c.json(
      successResponse(latest, "Latest products retrieved successfully"),
      HttpStatusCodes.OK,
    );
  },
);

// Get trending products (most sold in last 30 days)
products.get(
  "/trending",
  getTrendingProductsDoc,
  validator("query", LimitQuerySchema, validationHook),
  async (c) => {
    const { limit } = c.req.valid("query");
    const trending = await getTrendingProducts(limit ?? 4);
    return c.json(
      successResponse(trending, "Trending products retrieved successfully"),
      HttpStatusCodes.OK,
    );
  },
);

// Get shop products (filtered, sorted, paginated)
products.get(
  "/shop",
  getShopProductsDoc,
  validator("query", ShopQuerySchema, validationHook),
  async (c) => {
    const params = c.req.valid("query");
    const { products: shopProducts, total } = await getShopProducts({
      page: params.page,
      limit: params.limit,
      cat: params.cat,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort: params.sort,
      new: params.new,
    });
    return c.json(
      successResponse(shopProducts, "Shop products retrieved successfully", {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      }),
      HttpStatusCodes.OK,
    );
  },
);

// Search products by name
products.get(
  "/search",
  searchProductsDoc,
  validator("query", SearchQuerySchema, validationHook),
  async (c) => {
    const { q, limit } = c.req.valid("query");
    const results = await searchProducts(q, limit ?? 30);
    return c.json(
      successResponse(results, "Search results retrieved successfully"),
      HttpStatusCodes.OK,
    );
  },
);

// Get product by ID
products.get(
  "/:id",
  getProductDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const found = await getProductById(id);
    if (!found) {
      return c.json(
        errorResponse("NOT_FOUND", "Product not found"),
        HttpStatusCodes.NOT_FOUND,
      );
    }
    return c.json(
      successResponse(found, "Product retrieved successfully"),
      HttpStatusCodes.OK,
    );
  },
);

// ── write routes (auth + permission required) ──────────────────────

products.use(authed).use(permit({ product: ["create", "update", "delete"] }));

// Create product
products.post(
  "/",
  createProductDoc,
  validator("form", CreateProductSchema, validationHook),
  async (c) => {
    const parsed = c.req.valid("form");
    const user = c.get("user");

    const result = await createProduct(parsed, parsed.images, user.id);

    if (!result.ok) {
      if (result.type === "imageError") {
        return c.json(
          errorResponse(result.code, result.error),
          result.status as 422,
        );
      }
      if (result.type === "fieldError") {
        return c.json(
          errorResponse(
            "INVALID_DATA",
            getErrDetailsFromErrFields(result.fieldErrors),
            result.fieldErrors,
          ),
          HttpStatusCodes.BAD_REQUEST,
        );
      }
      // serverError
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", result.message),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      successResponse(result.data, "Product created successfully"),
      HttpStatusCodes.CREATED,
    );
  },
);

// Update product
products.put(
  "/:id",
  updateProductDoc,
  validator("param", UuidParamSchema, validationHook),
  validator("form", UpdateProductSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const parsed = c.req.valid("form");

    // Fetch existing product — needed by the validator (keepImageKeys,
    // effective stock) and by the service (to know which images to keep).
    const existing = await getProductById(id);
    if (!existing) {
      return c.json(
        errorResponse("NOT_FOUND", "Product not found"),
        HttpStatusCodes.NOT_FOUND,
      );
    }

    // `keepImageKeys` defaults to "keep all existing" when the client
    // omits the field entirely, but should be the actual array the client
    // sent when present (even if empty, meaning "delete all"). Zod's
    // `jsonArray` transform returns `[]` for both "missing" and "explicitly
    // empty", so we distinguish by checking the raw form data: if the field
    // is absent from the FormData, we pass the existing image keys as the
    // default, preserving the original "keep everything" behaviour.
    const rawForm = await c.req.parseBody();
    const keepImageKeys =
      parsed.keepImageKeys ??
      (rawForm.keepImageKeys === undefined
        ? existing.images.map((img) => img.key)
        : []);

    const result = await updateProduct(
      id,
      { ...parsed, keepImageKeys },
      parsed.newImages ?? [],
      existing,
    );

    if (!result.ok) {
      if (result.type === "fieldError") {
        return c.json(
          errorResponse(
            "INVALID_DATA",
            getErrDetailsFromErrFields(result.fieldErrors),
            result.fieldErrors,
          ),
          HttpStatusCodes.BAD_REQUEST,
        );
      }
      if (result.type === "imageError") {
        return c.json(
          errorResponse(result.code, result.error),
          result.status as 422,
        );
      }
      // serverError | conflict
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", result.message),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      successResponse(result.data, "Product updated successfully"),
      HttpStatusCodes.OK,
    );
  },
);

// Delete product
products.delete(
  "/:id",
  deleteProductDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");

    const result = await deleteProduct(id);

    if (!result.ok) {
      if (result.type === "conflict") {
        return c.json(
          errorResponse("CONFLICT", result.message),
          HttpStatusCodes.CONFLICT,
        );
      }
      if (result.type === "fieldError") {
        return c.json(
          errorResponse(
            "INVALID_DATA",
            getErrDetailsFromErrFields(result.fieldErrors),
            result.fieldErrors,
          ),
          HttpStatusCodes.BAD_REQUEST,
        );
      }
      if (result.type === "imageError") {
        return c.json(
          errorResponse(result.code, result.error),
          result.status as 422,
        );
      }
      // serverError
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", result.message),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return c.json(
      successResponse(result.data, "Product deleted successfully"),
      HttpStatusCodes.OK,
    );
  },
);

export default products;
