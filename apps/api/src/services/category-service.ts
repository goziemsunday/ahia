import { db, eq } from "@repo/db";
import { category } from "@repo/db/schemas/product.schema";

import {
  buildBaseSlug,
  findCategoryByCaseInsensitiveName,
  generateUniqueCategorySlug,
} from "@/lib/product-slug";

/**
 * Discriminated union for category operation results.
 */
export type CategoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; type: "conflict"; message: string }
  | { ok: false; type: "notFound"; message: string }
  | { ok: false; type: "hasProducts"; message: string }
  | { ok: false; type: "serverError"; message: string };

/**
 * Create a new category with a unique slug and case-insensitive name
 * check. Runs inside a single transaction — if the name already
 * exists, returns a typed conflict result instead of throwing.
 */
export const createCategory = async (
  name: string,
): Promise<CategoryResult<unknown>> => {
  try {
    const trimmedName = name.trim();

    const result = await db.transaction(async (tx) => {
      const existingCategory = await findCategoryByCaseInsensitiveName(
        trimmedName,
        undefined,
        tx,
      );

      if (existingCategory) {
        return {
          ok: false as const,
          type: "conflict" as const,
          name: "CATEGORY_EXISTS",
        };
      }

      const slug = await generateUniqueCategorySlug(
        buildBaseSlug(trimmedName),
        undefined,
        tx,
      );

      const [newCategory] = await tx
        .insert(category)
        .values({ name: trimmedName, slug })
        .returning();

      return { ok: true as const, data: newCategory };
    });

    if (!result.ok) {
      return {
        ok: false,
        type: "conflict",
        message: "Category name already exists",
      };
    }

    return { ok: true, data: result.data };
  } catch (err) {
    console.error("Error creating category:", err);
    return {
      ok: false,
      type: "serverError",
      message: "Failed to create category",
    };
  }
};

/**
 * Update a category's name and slug. Handles case-insensitive name
 * uniqueness check and slug regeneration. Returns typed results for
 * each failure mode.
 */
export const updateCategory = async (
  id: string,
  name: string,
): Promise<CategoryResult<unknown>> => {
  try {
    const trimmedName = name.trim();

    const categoryToUpdate = await db.query.category.findFirst({
      where: (c) => eq(c.id, id),
      with: { productCategories: { columns: { id: true } } },
    });

    if (!categoryToUpdate) {
      return { ok: false, type: "notFound", message: "Category not found" };
    }

    // No name change — return existing category as-is.
    if (trimmedName.toLowerCase() === categoryToUpdate.name.toLowerCase()) {
      return { ok: true, data: categoryToUpdate };
    }

    const result = await db.transaction(async (tx) => {
      const existingCategory = await findCategoryByCaseInsensitiveName(
        trimmedName,
        id,
        tx,
      );

      if (existingCategory) {
        return { ok: false as const, type: "conflict" as const };
      }

      const slug = await generateUniqueCategorySlug(
        buildBaseSlug(trimmedName),
        id,
        tx,
      );

      const [updatedCategory] = await tx
        .update(category)
        .set({ name: trimmedName, slug })
        .where(eq(category.id, id))
        .returning();

      return { ok: true as const, data: updatedCategory };
    });

    if (!result.ok) {
      return {
        ok: false,
        type: "conflict",
        message: "Category name already exists",
      };
    }

    return { ok: true, data: result.data };
  } catch (err) {
    console.error("Error updating category:", err);
    return {
      ok: false,
      type: "serverError",
      message: "Failed to update category",
    };
  }
};

/**
 * Delete a category by ID. Fails with typed results if the category
 * doesn't exist or has associated products.
 */
export const deleteCategory = async (
  id: string,
): Promise<CategoryResult<unknown>> => {
  try {
    const result = await db.transaction(async (tx) => {
      const categoryToDelete = await tx.query.category.findFirst({
        where: (c) => eq(c.id, id),
        with: { productCategories: { columns: { id: true } } },
      });

      if (!categoryToDelete) {
        return { ok: false as const, type: "notFound" as const };
      }

      if (categoryToDelete.productCategories.length > 0) {
        return { ok: false as const, type: "hasProducts" as const };
      }

      const [deletedCategory] = await tx
        .delete(category)
        .where(eq(category.id, id))
        .returning();

      return { ok: true as const, data: deletedCategory };
    });

    if (!result.ok) {
      switch (result.type) {
        case "notFound":
          return { ok: false, type: "notFound", message: "Category not found" };
        case "hasProducts":
          return {
            ok: false,
            type: "hasProducts",
            message: "Category has associated products",
          };
      }
    }

    return { ok: true, data: result.data };
  } catch (err) {
    console.error("Error deleting category:", err);
    return {
      ok: false,
      type: "serverError",
      message: "Failed to delete category",
    };
  }
};
