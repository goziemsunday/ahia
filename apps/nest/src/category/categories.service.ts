import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { count, db, eq } from "@repo/db";
import { category } from "@repo/db/schemas/product.schema";

import { buildBaseSlug } from "../lib/slug";
import {
  Category,
  CategoryWithCount,
  CategoryWithProducts,
} from "./categories.types";
import {
  findCategoryByCaseInsensitiveName,
  generateUniqueCategorySlug,
} from "./categories.utils";

@Injectable()
export class CategoriesService {
  // get all categories
  async getAll(
    page: number = 1,
    limit?: number,
  ): Promise<{ categories: CategoryWithCount[]; total: number }> {
    const queryOpts = {
      ...(limit ? { limit, offset: (page - 1) * limit } : {}),
      with: {
        productCategories: {
          columns: { id: true },
        },
      },
    } as const;

    const result = await db.query.category.findMany(queryOpts);

    const categories = result.map(({ productCategories, ...cat }) =>
      Object.assign(cat, { productCount: productCategories.length }),
    );

    const totalResult = await db.select({ count: count() }).from(category);
    const total = totalResult[0].count;

    // return total together with categories to build pagination object
    return { categories, total };
  }

  // get top categories
  async getTop(limit: number = 4): Promise<CategoryWithCount[]> {
    const result = await db.query.category.findMany({
      with: {
        productCategories: {
          columns: { id: true },
        },
      },
    });

    return result
      .map(({ productCategories, ...cat }) =>
        Object.assign(cat, { productCount: productCategories.length }),
      )
      .toSorted((a, b) => b.productCount - a.productCount)
      .slice(0, limit);
  }

  // get single category with its related products
  async getOneById(id: string): Promise<CategoryWithProducts> {
    const result = await db.query.category.findFirst({
      where: (cat, { eq }) => eq(cat.id, id),
      with: {
        productCategories: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!result) {
      throw new NotFoundException("Category not found");
    }

    const { productCategories, ...cat } = result;
    const products = productCategories.map((pc) => pc.product);

    return { ...cat, products };
  }

  // create new category
  async create(name: string): Promise<Category> {
    const trimmedName = name.trim();

    return await db.transaction(async (tx) => {
      const existingCategory = await findCategoryByCaseInsensitiveName(
        trimmedName,
        undefined,
        tx,
      );

      if (existingCategory) {
        throw new ConflictException("Category name already exists");
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

      return newCategory;
    });
  }

  // update category
  async update(id: string, name: string): Promise<Category> {
    const trimmedName = name.trim();

    return await db.transaction(async (tx) => {
      const categoryToUpdate = await db.query.category.findFirst({
        where: (c) => eq(c.id, id),
      });

      if (!categoryToUpdate) {
        throw new NotFoundException("Category not found");
      }

      // if there's no name change, return the existing category as-is
      if (trimmedName.toLowerCase() === categoryToUpdate.name.toLowerCase()) {
        return categoryToUpdate;
      }

      const existingCategory = await findCategoryByCaseInsensitiveName(
        trimmedName,
        id,
        tx,
      );

      if (existingCategory) {
        throw new ConflictException("Category name is already in use");
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

      return updatedCategory;
    });
  }

  // delete category
  async delete(id: string): Promise<Category> {
    return await db.transaction(async (tx) => {
      const categoryToDelete = await tx.query.category.findFirst({
        where: (c) => eq(c.id, id),
        with: { productCategories: { columns: { id: true } } },
      });

      if (!categoryToDelete) {
        throw new NotFoundException("Category not found");
      }
      if (categoryToDelete.productCategories.length > 0) {
        throw new ConflictException("Category has associated products");
      }

      const [deletedCategory] = await tx
        .delete(category)
        .where(eq(category.id, id))
        .returning();

      return deletedCategory;
    });
  }
}
