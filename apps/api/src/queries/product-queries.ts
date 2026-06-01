import { count, db, desc, ilike, sql, sum } from "@repo/db";
import { orderItem } from "@repo/db/schemas/order.schema";
import { product } from "@repo/db/schemas/product.schema";

import { DbOrTx } from "@/types";

/**
 * Return type of `getProductById`. Exported so other modules (e.g.
 * the product service) can reference the shape without re-querying or
 * duplicating the type definition.
 */
export type ProductWithRelations = NonNullable<
  Awaited<ReturnType<typeof getProductById>>
>;

/** Fetches products with related creator and categories, plus total count */
export const getProducts = async (page: number = 1, limit?: number) => {
  let result;
  if (limit) {
    result = await db.query.product.findMany({
      with: {
        creator: true,
        productCategories: {
          with: {
            category: true,
          },
        },
      },
      limit,
      offset: (page - 1) * limit,
    });
  } else {
    result = await db.query.product.findMany({
      with: {
        creator: true,
        productCategories: {
          with: {
            category: true,
          },
        },
      },
    });
  }

  if (!result) return { products: [], total: 0 };

  const products = result.map(({ productCategories, ...p }) =>
    Object.assign(p, {
      categories: productCategories?.map((pc) => pc.category) ?? [],
    }),
  );

  const totalResult = await db.select({ count: count() }).from(product);
  const total = totalResult[0].count;

  return { products, total };
};

/**
 * Fetches a single product with creator and categories.
 *
 * `executor` is optional — defaults to the global `db` instance. When
 * passed a transaction object (from `db.transaction(async (tx) => ...)`),
 * the read is part of the same transaction as the write, giving the
 * caller a consistent snapshot. The product service uses this inside its
 * transactions so the post-insert/update refetch sees its own writes.
 */
export const getProductById = async (id: string, executor: DbOrTx = db) => {
  const result = await executor.query.product.findFirst({
    where: (p, { eq }) => eq(p.id, id),
    with: {
      creator: true,
      productCategories: {
        with: {
          category: true,
        },
      },
    },
  });

  if (!result) return null;

  const { productCategories, ...p } = result;
  const categories = productCategories.map((pc) => pc.category);

  return { ...p, categories };
};

/** Fetches a deterministic "featured" product that changes daily */
export const getFeaturedProduct = async () => {
  const total = await db.select({ count: count() }).from(product);
  const totalProducts = total[0].count;
  if (totalProducts === 0) return null;

  // Deterministic offset from today's date (changes daily)
  const today = new Date();
  const daySeed =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();
  const offset = daySeed % totalProducts;

  const result = await db.query.product.findMany({
    with: {
      creator: true,
      productCategories: {
        with: { category: true },
      },
    },
    orderBy: (p) => p.createdAt,
    limit: 1,
    offset,
  });

  if (!result || result.length === 0) return null;

  const { productCategories, ...p } = result[0];
  return {
    ...p,
    categories: productCategories?.map((pc) => pc.category) ?? [],
  };
};

/** Fetches the N most recently created products */
export const getLatestProducts = async (limit: number = 4) => {
  const result = await db.query.product.findMany({
    with: {
      creator: true,
      productCategories: {
        with: { category: true },
      },
    },
    orderBy: (p) => desc(p.createdAt),
    limit,
  });

  if (!result) return [];

  return result.map(({ productCategories, ...p }) =>
    Object.assign(p, {
      categories: productCategories?.map((pc) => pc.category) ?? [],
    }),
  );
};

/** Fetches product IDs ranked by total quantity sold in the last 30 days */
export const getTrendingProductIds = async (
  limit: number = 4,
): Promise<string[]> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .select({
      productId: orderItem.productId,
      totalSold: sum(orderItem.quantity).mapWith(Number),
    })
    .from(orderItem)
    .where(sql`${orderItem.createdAt} >= ${thirtyDaysAgo.toISOString()}`)
    .groupBy(orderItem.productId)
    .orderBy(sql`${sum(orderItem.quantity)} desc`)
    .limit(limit);

  return result.map((r) => r.productId);
};

/** Fetches trending products with full details (most sold in the last 30 days) */
export const getTrendingProducts = async (limit: number = 4) => {
  const topIds = await getTrendingProductIds(limit);
  if (topIds.length === 0) return [];

  const result = await db.query.product.findMany({
    where: (p, { inArray }) => inArray(p.id, topIds),
    with: {
      creator: true,
      productCategories: {
        with: { category: true },
      },
    },
  });

  if (!result) return [];

  const products = result.map(({ productCategories, ...p }) =>
    Object.assign(p, {
      categories: productCategories?.map((pc) => pc.category) ?? [],
    }),
  );

  // Preserve the trending sort order
  return topIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p != null);
};

/** Fetches products for the shop page with filtering, sorting, and pagination */
export const getShopProducts = async (params: {
  page: number;
  limit: number;
  cat?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  new?: boolean;
}) => {
  const { page, limit, cat, minPrice, maxPrice, sort: sortBy } = params;

  // Get all products with relations
  let allProducts = await db.query.product.findMany({
    with: {
      creator: true,
      productCategories: {
        with: { category: true },
      },
    },
  });

  if (!allProducts) return { products: [], total: 0 };

  let products = allProducts.map(({ productCategories, ...p }) =>
    Object.assign(p, {
      categories: productCategories?.map((pc) => pc.category) ?? [],
    }),
  );

  // Filter by category slug
  if (cat) {
    products = products.filter((p) => p.categories.some((c) => c.slug === cat));
  }

  // Filter by "new" (created in the last 14 days)
  if (params.new) {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    products = products.filter((p) => new Date(p.createdAt) >= twoWeeksAgo);
  }

  // Filter by price range
  if (minPrice != null) {
    products = products.filter((p) => parseFloat(p.price) >= minPrice);
  }
  if (maxPrice != null) {
    products = products.filter((p) => parseFloat(p.price) <= maxPrice);
  }

  // Sort
  switch (sortBy) {
    case "price-asc":
      products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      break;
    case "price-desc":
      products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      break;
    case "newest":
      products.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
    default:
      // Default: newest first
      products.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      break;
  }

  const total = products.length;
  const paginated = products.slice((page - 1) * limit, page * limit);

  return { products: paginated, total };
};

/** Searches products by name and description, with name matches ranked first */
export const searchProducts = async (query: string, limit: number = 30) => {
  const withRelations = {
    creator: true,
    productCategories: {
      with: { category: true },
    },
  } as const;

  // First: products whose name matches (higher relevance)
  const nameMatches = await db.query.product.findMany({
    where: (p) => ilike(p.name, `%${query}%`),
    with: withRelations,
    limit,
  });

  const nameMatchIds = new Set(nameMatches.map((p) => p.id));

  // Second: products whose description matches but name does not
  const descMatches = await db.query.product.findMany({
    where: (p, { and, not }) =>
      and(ilike(p.description, `%${query}%`), not(ilike(p.name, `%${query}%`))),
    with: withRelations,
    limit: limit - nameMatches.length,
  });

  return [
    ...nameMatches.map(({ productCategories, ...p }) =>
      Object.assign(p, {
        categories: productCategories?.map((pc) => pc.category) ?? [],
      }),
    ),
    ...descMatches
      .filter((p) => !nameMatchIds.has(p.id))
      .map(({ productCategories, ...p }) =>
        Object.assign(p, {
          categories: productCategories?.map((pc) => pc.category) ?? [],
        }),
      ),
  ];
};
