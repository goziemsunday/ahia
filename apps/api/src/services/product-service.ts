import { db, eq } from "@repo/db";
import { productCategory } from "@repo/db/schemas/product.schema";

import {
  cleanupUploadedImages,
  uploadProductImages,
  withImageRollback,
} from "@/lib/image-upload";
import { generateUniqueProductSlug, product } from "@/lib/product-slug";
import {
  validateCreateImagePayload,
  validateCreateProductInput,
  validateFinalImageCount,
  validateNewImages,
  validateUpdateProductInput,
  type RawCreateInput,
  type RawUpdateInput,
} from "@/lib/product-validators";
import { getCategoriesById } from "@/queries/category-queries";
import {
  getProductById,
  type ProductWithRelations,
} from "@/queries/product-queries";
import { ImageRef } from "@/types";

// ── result types ────────────────────────────────────────────────────

/**
 * Discriminated-union return type for every service function. The route
 * handler maps these to HTTP responses:
 *
 *   `ok`         → 200/201 with `successResponse(data, message)`
 *   `fieldError` → 400 with `errorResponse("INVALID_DATA", ..., fields)`
 *   `imageError` → 422 with `errorResponse("INVALID_FILE", ...)`
 *   `conflict`   → 409 with `errorResponse("CONFLICT", ...)`
 *   `serverError`→ 500 with `errorResponse("INTERNAL_SERVER_ERROR", ...)`
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      type: "fieldError";
      fieldErrors: Record<string, string>;
    }
  | {
      ok: false;
      type: "imageError";
      error: string;
      status: number;
      code: string;
    }
  | { ok: false; type: "conflict"; message: string }
  | { ok: false; type: "serverError"; message: string };

// ── create ──────────────────────────────────────────────────────────

/**
 * Create a new product with images and category associations.
 *
 * Accepts the Zod-parsed form data (sizes/colors/categoryIds are already
 * typed arrays thanks to the `jsonArray` transforms in `lib/schemas.ts`).
 *
 * Image upload happens before the DB transaction so that if the
 * transaction fails, the `withImageRollback` wrapper can clean up the
 * uploaded R2 objects. R2 is not part of the DB's atomicity guarantees,
 * so this is a best-effort cleanup. An orphaned R2 object is far less
 * bad than masking the real error.
 */
export const createProduct = async (
  parsed: RawCreateInput,
  images: unknown[],
  creatorId: string,
): Promise<ServiceResult<unknown>> => {
  // ── 1. image validation ─────────────────────────────────────────
  // Image validation is the only piece that can fail with 422
  // INVALID_FILE (type, size, format). Keeping it separate from the
  // 400 INVALID_DATA flow preserves the original HTTP semantics.
  const imgCheck = validateCreateImagePayload(images);
  if (!imgCheck.ok) {
    return {
      ok: false,
      type: "imageError",
      error: imgCheck.error,
      status: imgCheck.status,
      code: imgCheck.code,
    };
  }

  // ── 2. cross-field validation ───────────────────────────────────
  const inputCheck = validateCreateProductInput(parsed);
  if (!inputCheck.ok) {
    return {
      ok: false,
      type: "fieldError",
      fieldErrors: inputCheck.fieldErrors,
    };
  }

  // ── 3. required-field checks not expressible in Zod ─────────────
  // `categoryIds` is parsed from JSON by Zod; an empty string becomes
  // `[]`. We need at least one category for the product to be visible
  // in any category filter. Zod can't enforce "array min length > 0"
  // without `.min(1)` on the array, but `jsonArray()` returns `[]` on
  // empty input, so the check belongs here.
  if (inputCheck.data.categoryIds.length === 0) {
    return {
      ok: false,
      type: "fieldError",
      fieldErrors: { categoryIds: "At least one category is required" },
    };
  }
  if (images.length === 0) {
    return {
      ok: false,
      type: "fieldError",
      fieldErrors: { images: "At least 1 image is required" },
    };
  }

  // ── 4. pre-flight: categories exist? ────────────────────────────
  const existingCategories = await getCategoriesById(
    inputCheck.data.categoryIds,
  );
  if (existingCategories.length !== inputCheck.data.categoryIds.length) {
    return {
      ok: false,
      type: "fieldError",
      fieldErrors: { categoryIds: "One or more categories not found" },
    };
  }

  // ── 5. slug generation ──────────────────────────────────────────
  const baseSlug = inputCheck.data.name.trim().toLowerCase();
  const slug = await generateUniqueProductSlug(baseSlug);

  // ── 6. upload images to R2 ──────────────────────────────────────
  const uploaded = await uploadProductImages(images as File[]);

  // ── 7. DB write inside transaction + R2 rollback wrapper ────────
  return await withImageRollback(uploaded, async () => {
    try {
      const result = await db.transaction(async (tx) => {
        // Insert the product row
        const [newProduct] = await tx
          .insert(product)
          .values({
            name: inputCheck.data.name.trim(),
            slug,
            description: inputCheck.data.description?.trim(),
            price: inputCheck.data.price,
            stockQuantity: inputCheck.data.stockQuantity,
            sizes: inputCheck.data.sizes,
            colors: inputCheck.data.colors,
            createdBy: creatorId,
            images: uploaded.map((img) => ({ url: img.url, key: img.key })),
          })
          .returning();

        // Create product ↔ category join-table rows
        if (inputCheck.data.categoryIds.length > 0) {
          await tx.insert(productCategory).values(
            inputCheck.data.categoryIds.map((categoryId) => ({
              productId: newProduct.id,
              categoryId,
            })),
          );
        }

        // Refetch the complete product *inside* the transaction so the
        // read is consistent with the writes (no concurrent-delete race).
        const full = await getProductById(newProduct.id, tx);
        return full!;
      });

      return { ok: true, data: result };
    } catch (err) {
      console.error("Error creating product:", err);
      return {
        ok: false,
        type: "serverError",
        message: "Failed to create product",
      };
    }
  });
};

// ── update ──────────────────────────────────────────────────────────

/**
 * Update an existing product. Handles name changes (re-generates slug),
 * partial field updates, image replacement (keep + new), and category
 * re-association.
 *
 * The caller must pass the already-fetched `existingProduct` (from the
 * GET /:id or a prior query). This avoids a redundant DB read inside the
 * service while still giving the validators the current state they need
 * (e.g. keepImageKeys validation, effective stock for variant rules).
 *
 * Old images that are no longer in `keepImageKeys` are deleted from R2
 * after the transaction commits. This is intentional: if the R2
 * delete fails, the DB state is still correct (the product no longer
 * references those images), and the orphaned R2 objects are cleaned up
 * manually or by a periodic job. Deleting inside the transaction would
 * mean an R2 failure rolls back the DB — too tightly coupled.
 */
export const updateProduct = async (
  id: string,
  parsed: RawUpdateInput,
  newImages: unknown[],
  existingProduct: ProductWithRelations,
): Promise<ServiceResult<unknown>> => {
  // ── 1. cross-field validation ───────────────────────────────────
  const inputCheck = validateUpdateProductInput(parsed, {
    stockQuantity: existingProduct.stockQuantity ?? 0,
    images: existingProduct.images,
  });
  if (!inputCheck.ok) {
    return {
      ok: false,
      type: "fieldError",
      fieldErrors: inputCheck.fieldErrors,
    };
  }

  // ── 2. new-image validation ─────────────────────────────────────
  const newImagesArray = Array.isArray(newImages) ? newImages : [];
  if (newImagesArray.length > 0) {
    const imgCheck = validateNewImages(newImagesArray);
    if (!imgCheck.ok) {
      return {
        ok: false,
        type: "fieldError",
        fieldErrors: imgCheck.fieldErrors,
      };
    }
  }

  // ── 3. total image count check ──────────────────────────────────
  // After update: kept images + new images must be 1-3.
  const keptCount = inputCheck.data.keepImageKeys.length;
  const imgCountCheck = validateFinalImageCount(
    keptCount,
    newImagesArray.length,
  );
  if (!imgCountCheck.ok) {
    return {
      ok: false,
      type: "fieldError",
      fieldErrors: { images: imgCountCheck.error },
    };
  }

  // ── 4. categories exist? (only if categoryIds provided) ─────────
  if (
    inputCheck.data.categoryIds !== undefined &&
    inputCheck.data.categoryIds.length > 0
  ) {
    const existingCategories = await db.query.category.findMany({
      where: (c, { inArray }) => inArray(c.id, inputCheck.data.categoryIds!),
    });
    if (existingCategories.length !== inputCheck.data.categoryIds.length) {
      return {
        ok: false,
        type: "fieldError",
        fieldErrors: { categoryIds: "One or more categories not found" },
      };
    }
  }

  // ── 5. slug generation (only if name changed) ───────────────────
  let slug: string | undefined;
  if (
    inputCheck.data.name !== undefined &&
    inputCheck.data.name.trim() !== existingProduct.name
  ) {
    slug = await generateUniqueProductSlug(
      inputCheck.data.name.trim(),
      id, // exclude self from slug collision check
    );
  }

  // ── 6. upload new images to R2 ──────────────────────────────────
  let uploaded: ImageRef[] = [];
  if (newImagesArray.length > 0) {
    uploaded = await uploadProductImages(newImagesArray as File[]);
  }

  // ── 7. DB write inside transaction ──────────────────────────────
  try {
    const result = await db.transaction(async (tx) => {
      // Build the update payload — only include fields that were provided.
      // The `.set()` call is type-safe against the Drizzle schema's insert
      // type.
      const updateData: Record<string, unknown> = {};

      if (inputCheck.data.name !== undefined)
        updateData.name = inputCheck.data.name.trim();
      if (inputCheck.data.description !== undefined)
        updateData.description = inputCheck.data.description?.trim();
      if (inputCheck.data.price !== undefined)
        updateData.price = inputCheck.data.price;
      if (inputCheck.data.stockQuantity !== undefined)
        updateData.stockQuantity = inputCheck.data.stockQuantity;
      if (inputCheck.data.sizes !== undefined)
        updateData.sizes = inputCheck.data.sizes;
      if (inputCheck.data.colors !== undefined)
        updateData.colors = inputCheck.data.colors;
      if (slug !== undefined) updateData.slug = slug;

      // Handle images: combine kept images (filtered from existing) with
      // newly uploaded images. Only touch images if the client sent
      // keepImageKeys or newImages — otherwise leave them unchanged.
      if (parsed.keepImageKeys !== undefined || newImagesArray.length > 0) {
        const keptImages = existingProduct.images.filter((img) =>
          inputCheck.data.keepImageKeys.includes(img.key),
        );
        updateData.images = [...keptImages, ...uploaded];
      }

      // Nothing to update? Return existing product as-is.
      if (
        Object.keys(updateData).length === 0 &&
        inputCheck.data.categoryIds === undefined
      ) {
        return existingProduct;
      }

      // Execute the update
      const [updatedProduct] = await tx
        .update(product)
        .set(updateData)
        .where(eq(product.id, id))
        .returning();

      // Replace category associations if categoryIds was provided
      if (inputCheck.data.categoryIds !== undefined) {
        await tx
          .delete(productCategory)
          .where(eq(productCategory.productId, id));

        if (inputCheck.data.categoryIds.length > 0) {
          await tx.insert(productCategory).values(
            inputCheck.data.categoryIds.map((categoryId) => ({
              productId: id,
              categoryId,
            })),
          );
        }
      }

      // Refetch inside the transaction for consistency
      return await getProductById(updatedProduct.id, tx);
    });

    // ── 8. post-commit: clean up old images from R2 ───────────────
    // This runs after the transaction commits. If it fails, the DB is
    // still correct — the product no longer references those images.
    if (parsed.keepImageKeys !== undefined || newImagesArray.length > 0) {
      const imagesToDelete = existingProduct.images
        .filter((img) => !inputCheck.data.keepImageKeys.includes(img.key))
        .map((img) => img.key);

      if (imagesToDelete.length > 0) {
        await cleanupUploadedImages(imagesToDelete.map((key) => ({ key })));
      }
    }

    return { ok: true, data: result };
  } catch (err) {
    // ── 9. transaction failure: clean up newly uploaded images ────
    if (uploaded.length > 0) {
      await cleanupUploadedImages(uploaded);
    }
    console.error("Error updating product:", err);
    return {
      ok: false,
      type: "serverError",
      message: "Failed to update product",
    };
  }
};

// ── delete ──────────────────────────────────────────────────────────

/**
 * Delete a product by ID. Checks for dependencies (cart items, order
 * items) before deleting and blocks deletion if any exist.
 *
 * The DB delete cascades to `product_category` rows via the foreign key.
 * R2 image cleanup runs after the transaction commits — same rationale
 * as in update: a failed R2 delete doesn't undo the DB state.
 */
export const deleteProduct = async (
  id: string,
): Promise<ServiceResult<unknown>> => {
  // ── 1. product exists? ──────────────────────────────────────────
  const existing = await getProductById(id);
  if (!existing) {
    return {
      ok: false,
      type: "conflict",
      message: "Product not found",
    };
  }

  // ── 2. dependency check ─────────────────────────────────────────
  // If the product is referenced by any cart item or order item, block
  // deletion.
  const cartItems = await db.query.cartItem.findMany({
    where: (ci, { eq }) => eq(ci.productId, id),
    columns: { id: true },
  });
  const orderItems = await db.query.orderItem.findMany({
    where: (oi, { eq }) => eq(oi.productId, id),
    columns: { id: true },
  });

  if (cartItems.length > 0 || orderItems.length > 0) {
    const deps: string[] = [];
    if (cartItems.length > 0) deps.push("user carts");
    if (orderItems.length > 0) deps.push("orders");
    return {
      ok: false,
      type: "conflict",
      message: `Product cannot be deleted as it exists in ${deps.join(" and ")}`,
    };
  }

  // ── 3. DB delete inside transaction ─────────────────────────────
  try {
    await db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(product)
        .where(eq(product.id, id))
        .returning();
      return deleted;
    });

    // ── 4. post-commit: clean up images from R2 ───────────────────
    // Best-effort: if this fails, the product is already gone from the
    // DB and the images are orphaned. Logged but not thrown.
    if (existing.images.length > 0) {
      await cleanupUploadedImages(existing.images);
    }

    return { ok: true, data: existing };
  } catch (err) {
    console.error("Error deleting product:", err);
    return {
      ok: false,
      type: "serverError",
      message: "Failed to delete product",
    };
  }
};
