import { Injectable, NotFoundException } from "@nestjs/common";

import { count, db, DbOrTx, desc, ilike, sql, sum } from "@repo/db";
import { orderItem } from "@repo/db/schemas/order.schema";
import { product } from "@repo/db/schemas/product.schema";

import { ProductWithRelations, ShopQueryType } from "./products.types";

@Injectable()
export class ProductsService {
  // get all products
  async getAll(
    page: number = 1,
    limit?: number,
  ): Promise<{ products: ProductWithRelations[]; total: number }> {
    const queryOpts = {
      ...(limit ? { limit, offset: (page - 1) * limit } : {}),
      with: {
        creator: true,
        productCategories: {
          with: {
            category: true,
          },
        },
      },
    } as const;

    const result = await db.query.product.findMany(queryOpts);

    const products = result.map(({ productCategories, ...p }) =>
      Object.assign(p, {
        categories: productCategories?.map((pc) => pc.category) ?? [],
      }),
    );

    const totalResult = await db.select({ count: count() }).from(product);
    const total = totalResult[0].count;

    return { products, total };
  }

  // get the featured product
  async getFeatured(): Promise<ProductWithRelations> {
    const total = await db.select({ count: count() }).from(product);
    const totalProducts = total[0].count;

    if (totalProducts === 0) {
      throw new NotFoundException("Product not found");
    }

    // deterministic offset from today's date (changes daily)
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

    if (result.length === 0) {
      throw new NotFoundException("Featured product not found");
    }

    const { productCategories, ...p } = result[0];
    return {
      ...p,
      categories: productCategories?.map((pc) => pc.category) ?? [],
    };
  }

  // get the latest products
  async getLatest(limit: number = 4): Promise<ProductWithRelations[]> {
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

    if (result.length === 0) {
      throw new NotFoundException("Latest products not found");
    }

    return result.map(({ productCategories, ...p }) =>
      Object.assign(p, {
        categories: productCategories?.map((pc) => pc.category) ?? [],
      }),
    );
  }

  // get the trending products
  async getTrending(limit: number = 4): Promise<ProductWithRelations[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // get the IDs of top products from order items
    const topIdsResult = await db
      .select({
        productId: orderItem.productId,
        totalSold: sum(orderItem.quantity).mapWith(Number),
      })
      .from(orderItem)
      .where(sql`${orderItem.createdAt} >= ${thirtyDaysAgo.toISOString()}`)
      .groupBy(orderItem.productId)
      .orderBy(sql`${sum(orderItem.quantity)} desc`)
      .limit(limit);

    const topIds = topIdsResult.map((r) => r.productId);
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

    // preserve the trending sort order
    return topIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p) => p != null);
  }

  // get shop products
  async getShop(
    params: ShopQueryType,
  ): Promise<{ products: ProductWithRelations[]; total: number }> {
    const {
      page,
      limit,
      cat,
      minPrice,
      maxPrice,
      sort: sortBy,
      new: isNew,
    } = params;

    // get all products with relations
    const allProducts = await db.query.product.findMany({
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

    // filter by category slug
    if (cat) {
      products = products.filter((p) =>
        p.categories.some((c) => c.slug === cat),
      );
    }

    // filter by "new" (created in the last 14 days)
    if (isNew) {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      products = products.filter((p) => new Date(p.createdAt) >= twoWeeksAgo);
    }

    // filter by price range
    if (typeof minPrice === "number" && !isNaN(minPrice)) {
      products = products.filter((p) => parseFloat(p.price) >= minPrice);
    }
    if (typeof maxPrice === "number" && !isNaN(maxPrice)) {
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
        // default: newest first
        products.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
    }

    const total = products.length;
    const paginated = products.slice((page - 1) * limit, page * limit);

    return { products: paginated, total };
  }

  // search for products
  async search(
    query: string,
    limit: number = 30,
  ): Promise<ProductWithRelations[]> {
    const withRelations = {
      creator: true,
      productCategories: {
        with: { category: true },
      },
    } as const;

    // first: products whose name matches (higher relevance)
    const nameMatches = await db.query.product.findMany({
      where: (p) => ilike(p.name, `%${query}%`),
      with: withRelations,
      limit,
    });

    const nameMatchIds = new Set(nameMatches.map((p) => p.id));

    // second: products whose description matches but name does not
    const descMatches = await db.query.product.findMany({
      where: (p, { and, not }) =>
        and(
          ilike(p.description, `%${query}%`),
          not(ilike(p.name, `%${query}%`)),
        ),
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
  }

  // get single product
  async getOne(
    id: string,
    executor: DbOrTx = db,
  ): Promise<ProductWithRelations> {
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

    if (!result) {
      throw new NotFoundException("Product not found");
    }

    const { productCategories, ...p } = result;
    const categories = productCategories.map((pc) => pc.category);

    return { ...p, categories };
  }
}
