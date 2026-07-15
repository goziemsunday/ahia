import { count, db, inArray } from "@repo/db";
import { category } from "@repo/db/schemas/product.schema";

/** Fetches categories with optional pagination and total count */
export const getCategories = async (page: number = 1, limit?: number) => {
  const queryOpts = {
    ...(limit ? { limit, offset: (page - 1) * limit } : {}),
    with: {
      productCategories: {
        columns: { id: true },
      },
    },
  } as const;

  const result = await db.query.category.findMany(queryOpts);

  if (!result) return { categories: [], total: 0 };

  const categories = result.map(({ productCategories, ...cat }) =>
    Object.assign(cat, { productCount: productCategories.length }),
  );

  const totalResult = await db.select({ count: count() }).from(category);
  const total = totalResult[0].count;

  return { categories, total };
};

/** Fetches categories with their IDs */
export const getCategoriesById = async (ids: string[]) => {
  const categories = await db.query.category.findMany({
    where: (c) => inArray(c.id, ids),
  });

  return categories;
};

/** Fetches a single category with its related products */
export const getCategoryById = async (id: string) => {
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

  if (!result) return null;

  const { productCategories, ...cat } = result;
  const products = productCategories.map((pc) => pc.product);

  return { ...cat, products };
};

/** Fetches the top N categories sorted by product count (descending) */
export const getTopCategories = async (limit: number = 4) => {
  const result = await db.query.category.findMany({
    with: {
      productCategories: {
        columns: { id: true },
      },
    },
  });

  if (!result) return [];

  return result
    .map(({ productCategories, ...cat }) =>
      Object.assign(cat, { productCount: productCategories.length }),
    )
    .toSorted((a, b) => b.productCount - a.productCount)
    .slice(0, limit);
};
