import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";

import { count, db, DbOrTx, desc, eq, ilike, sql, sum } from "@repo/db";
import { orderItem } from "@repo/db/schemas/order.schema";
import { product, productCategory } from "@repo/db/schemas/product.schema";

import { CategoriesService } from "../category/categories.service";
import { MAX_PRODUCT_IMAGES, MIN_PRODUCT_IMAGES } from "../lib/file";
import { InStockSchema } from "./product.validators";
import { CreateProductDto, UpdateProductDto } from "./products.dto";
import {
  InStockItem,
  ProductWithRelations,
  ShopQueryType,
} from "./products.types";
import {
  cleanupUploadedImages,
  generateUniqueProductSlug,
  uploadProductImages,
  withImageRollback,
} from "./products.utils";

@Injectable()
export class ProductsService {
  constructor(private categoriesService: CategoriesService) {}

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

  // create product
  async create(
    body: CreateProductDto,
    images: Express.Multer.File[],
    creatorId: string,
  ): Promise<ProductWithRelations> {
    // parse JSON strings from the form
    const sizes = this.parseJsonString("sizes", body.sizes, InStockSchema);
    const colors = this.parseJsonString("colors", body.colors, InStockSchema);
    const categoryIds = this.parseJsonString(
      "categoryIds",
      body.categoryIds,
      z.uuid({ message: "Must be a valid UUID" }),
    );

    // check for at least one image
    if (images.length < 1) {
      throw new BadRequestException("At least 1 image is required");
    }

    // validate price: ensure the price is a positive number
    const priceFloat = Number.parseFloat(body.price);
    if (Number.isNaN(priceFloat) || priceFloat <= 0) {
      throw new BadRequestException("Price must be a positive number");
    }
    // price is turned back into a string here because the DB column is numeric(10,2)
    // and we store it pre-formatted (eg. "12.50") for stable display.
    const price = priceFloat.toFixed(2);

    // validate stock quantity: ensure the stock qty is a non-negative number
    const stockQty = Number.parseInt(body.stockQuantity, 10);
    if (Number.isNaN(stockQty) || stockQty < 0) {
      throw new BadRequestException(
        "Stock quantity must be a non-negative number",
      );
    }

    // validate sizes & colors: ensure each size & color is unique and that there is
    // at least one size and color when stock quantity is greater than 0
    this.validateVariants("sizes", sizes, stockQty);
    this.validateVariants("colors", colors, stockQty);

    // validate categories: ensure the product is associated with at least one category
    if (categoryIds.length === 0) {
      throw new BadRequestException("At least one category is required");
    }

    // ensure categories actually exists
    const categories = await this.categoriesService.getByIds(categoryIds);
    if (categories.length !== categoryIds.length) {
      throw new BadRequestException("One or more categories not found");
    }

    const name = body.name.trim();
    const description = body.description?.trim();

    // generate slugs
    const baseSlug = name.toLowerCase();
    const slug = await generateUniqueProductSlug(baseSlug);

    // upload images to R2
    const webFiles = images.map(
      (f) =>
        new File([f.buffer as BlobPart], f.originalname, { type: f.mimetype }),
    );
    const uploaded = await uploadProductImages(webFiles);

    // DB write inside transaction + R2 rollback wrapper
    return await withImageRollback(uploaded, async () => {
      return await db.transaction(async (tx) => {
        // insert the product row
        const [newProduct] = await tx
          .insert(product)
          .values({
            name: name,
            slug,
            description,
            price: price,
            stockQuantity: stockQty,
            sizes: sizes,
            colors: colors,
            createdBy: creatorId,
            images: uploaded.map((img) => ({ url: img.url, key: img.key })),
          })
          .returning();

        // create product ↔ category join-table rows
        if (categoryIds.length > 0) {
          await tx.insert(productCategory).values(
            categoryIds.map((categoryId) => ({
              productId: newProduct.id,
              categoryId,
            })),
          );
        }

        // refetch the complete product inside the transaction so the
        // read is consistent with the writes (no concurrent-delete race)
        return await this.getOne(newProduct.id, tx);
      });
    });
  }

  // update product
  async update(
    productId: string,
    body: UpdateProductDto,
    images: Express.Multer.File[],
  ): Promise<ProductWithRelations> {
    // ensure product already exists
    const existing = await this.getOne(productId);

    // parse JSON strings from the form
    const sizes = body.sizes
      ? this.parseJsonString("sizes", body.sizes, InStockSchema)
      : existing.sizes;
    const colors = body.colors
      ? this.parseJsonString("colors", body.colors, InStockSchema)
      : existing.colors;
    const categoryIds = body.categoryIds
      ? this.parseJsonString(
          "categoryIds",
          body.categoryIds,
          z.uuid({ message: "Must be a valid UUID" }),
        )
      : existing.categories.map((cat) => cat.id);

    // `keepImageKeys` defaults to "keep all existing" when the client omits the field
    // entirely. we ensure this by adding the keys of the existing images of the product to
    // `keepImageKeys`.if an empty array is sent by the client, this will be interpreted as
    // "delete all existing images".
    // we also ensure that the `keepImageKeys` sent from the client contain keys that
    // actually belong to the product images.
    let keepImageKeys: string[];
    if (body.keepImageKeys !== undefined) {
      keepImageKeys = Array.from(
        new Set(
          this.parseJsonString("keepImageKeys", body.keepImageKeys, z.string()),
        ),
      );
      const existingImageKeys = new Set(existing.images.map((img) => img.key));
      const invalid = keepImageKeys.filter((k) => !existingImageKeys.has(k));
      if (invalid.length > 0) {
        throw new BadRequestException(
          invalid.length === 1
            ? `Invalid image key: '${invalid[0]}' doesn't exist in this product`
            : `Invalid image keys: '${invalid.join("', '")}' don't exist in this product`,
        );
      }
    } else {
      keepImageKeys = Array.from(
        new Set(existing.images.map((img) => img.key)),
      );
    }

    // ensure that the final image count is not below or above the limits
    const totalImgCount = keepImageKeys.length + images.length;
    if (totalImgCount < MIN_PRODUCT_IMAGES) {
      throw new BadRequestException("At least 1 image is required");
    }
    if (totalImgCount > MAX_PRODUCT_IMAGES) {
      throw new BadRequestException("Maximum 3 images allowed");
    }

    // validate price: ensure the price (if provided) is a positive number
    // if not provided, use the existing price
    const priceFloat = Number.parseFloat(body.price ?? existing.price);
    if (Number.isNaN(priceFloat) || priceFloat <= 0) {
      throw new BadRequestException("Price must be a positive number");
    }
    // price is turned back into a string here because the DB column is numeric(10,2)
    // and we store it pre-formatted (eg. "12.50") for stable display.
    const price = priceFloat.toFixed(2);

    // validate stock quantity: ensure the stock qty is a non-negative number
    const stockQty = Number.parseInt(
      body.stockQuantity ?? String(existing.stockQuantity ?? 0),
      10,
    );
    if (Number.isNaN(stockQty) || stockQty < 0) {
      throw new BadRequestException(
        "Stock quantity must be a non-negative number",
      );
    }

    // validate sizes & colors: ensure each size & color is unique and that there is
    // at least one size and color when stock quantity is greater than 0
    this.validateVariants("sizes", sizes, stockQty);
    this.validateVariants("colors", colors, stockQty);

    // validate categories: ensure the product is associated with at least one category
    if (categoryIds.length === 0) {
      throw new BadRequestException("At least one category is required");
    }

    // ensure categories actually exists
    const categories = await this.categoriesService.getByIds(categoryIds);
    if (categories.length !== categoryIds.length) {
      throw new BadRequestException("One or more categories not found");
    }

    const name = body.name ? body.name.trim() : existing.name;
    const description =
      body.description !== undefined
        ? body.description.trim()
        : existing.description;

    // generate slugs
    const baseSlug = name.toLowerCase();
    const slug =
      name === existing.name
        ? existing.slug
        : await generateUniqueProductSlug(baseSlug, productId);

    // upload images to R2
    const webFiles = images.map(
      (f) =>
        new File([f.buffer as BlobPart], f.originalname, { type: f.mimetype }),
    );
    const uploaded = await uploadProductImages(webFiles);

    // DB write inside transaction + R2 rollback wrapper
    const updatedProducts = await withImageRollback(uploaded, async () => {
      return await db.transaction(async (tx) => {
        const keptImages = existing.images.filter((img) =>
          keepImageKeys.includes(img.key),
        );
        const imagesUpdate = [...keptImages, ...uploaded];

        // execute the update
        const [updatedProduct] = await tx
          .update(product)
          .set({
            name,
            description,
            slug,
            price,
            stockQuantity: stockQty,
            sizes,
            colors,
            images: imagesUpdate,
          })
          .where(eq(product.id, productId))
          .returning();

        // replace category associations if categoryIds was provided
        await tx
          .delete(productCategory)
          .where(eq(productCategory.productId, productId));
        if (categoryIds.length > 0) {
          await tx.insert(productCategory).values(
            categoryIds.map((categoryId) => ({
              productId,
              categoryId,
            })),
          );
        }

        // refetch the complete product inside the transaction for consistency
        return await this.getOne(updatedProduct.id, tx);
      });
    });

    // this runs after the transaction commits. if it fails, the DB is still correct,
    // since the product no longer references those images.
    try {
      if (images.length > 0) {
        const imagesToDelete = existing.images
          .filter((img) => !keepImageKeys.includes(img.key))
          .map((img) => img.key);

        if (imagesToDelete.length > 0) {
          await cleanupUploadedImages(imagesToDelete.map((key) => ({ key })));
        }
      }
    } catch {
      console.error("update product old images cleanup failed");
    }

    return updatedProducts;
  }

  // delete product
  async delete(productId: string): Promise<ProductWithRelations> {
    // ensure product already exists
    const existing = await this.getOne(productId);

    // block deletion if the product is related to any cart item or order item
    const cartItems = await db.query.cartItem.findMany({
      where: (ci, { eq }) => eq(ci.productId, productId),
      columns: { id: true },
    });
    const orderItems = await db.query.orderItem.findMany({
      where: (oi, { eq }) => eq(oi.productId, productId),
      columns: { id: true },
    });
    if (cartItems.length > 0 || orderItems.length > 0) {
      const deps: string[] = [];
      if (cartItems.length > 0) deps.push("user carts");
      if (orderItems.length > 0) deps.push("orders");
      throw new ConflictException(
        `Product cannot be deleted as it exists in ${deps.join(" and ")}`,
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(product).where(eq(product.id, productId));
    });

    // clean up images from R2. if this fails, the the product is already gone from
    // the DB and the images orphaned.
    try {
      if (existing.images.length > 0) {
        await cleanupUploadedImages(existing.images);
      }
    } catch {
      console.error("deleted product images cleanup failed");
    }

    return existing;
  }

  // parse JSON strings and return JSON data
  parseJsonString<T extends z.ZodType>(
    name: string,
    jsonString: string | undefined,
    schema: T,
  ): z.infer<T>[] {
    const parsed = z
      .array(schema)
      .safeParse(jsonString ? JSON.parse(jsonString) : []);

    if (!parsed.success) {
      throw new BadRequestException(
        `${name}: ${parsed.error.issues[0].message}`,
      );
    }

    return parsed.data;
  }

  // verify that the variant list (sizes or colors) is internally consistent
  validateVariants(
    field: string,
    items: InStockItem[],
    effectiveStock: number,
  ) {
    const names = items.map((i) => i.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      throw new BadRequestException(
        `${field} names must be unique (case-insensitive)`,
      );
    }

    if (effectiveStock > 0 && !items.some((i) => i.inStock)) {
      throw new BadRequestException(
        `At least one ${field.slice(0, -1)} must be in stock when stock quantity is greater than 0`,
      );
    }
  }
}
