import slugifyLib from "slugify";

import { and, db, eq, like, ne, or, sql } from "@repo/db";
import { category, product } from "@repo/db/schemas/product.schema";

import { DbOrTx } from "@/types";

/**
 * Build the base slug from a human-readable name. Uses the `slugify` package
 * with `lower: true` and `strict: true` to strip non-URL-safe characters.
 *
 * Exported so callers can show the user what slug was generated before the
 * collision-resolution step (e.g. for "would you like to use this slug
 * instead?" UX in the future).
 */
export const buildBaseSlug = (name: string): string =>
  slugifyLib(name.trim(), { lower: true, strict: true });

/**
 * Find a slug derived from `baseSlug` that does not already exist on the
 * product table. If `baseSlug` is free, returns it. Otherwise appends
 * `-1`, `-2`, ... until a free one is found.
 *
 * `excludeProductId` lets update flows skip the row being updated (otherwise
 * renaming a product to its own current name would always collide).
 */
export const generateUniqueProductSlug = async (
  baseSlug: string,
  excludeProductId?: string,
): Promise<string> => {
  // Pull every slug that could collide with our base or any `-N` suffix.
  // This is one query, not N — we just need the set of taken suffixes.
  const existingSlugs = await db.query.product.findMany({
    where: excludeProductId
      ? (p) =>
          and(
            or(eq(p.slug, baseSlug), like(p.slug, `${baseSlug}-%`)),
            ne(p.id, excludeProductId),
          )
      : (p) => or(eq(p.slug, baseSlug), like(p.slug, `${baseSlug}-%`)),
    columns: { slug: true },
  });

  const taken = new Set(existingSlugs.map((p) => p.slug));

  // Walk 0, 1, 2, ... until we find an unused suffix. `0` means no suffix.
  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    counter++;
  }
};

/**
 * Look up a single product by its slug. Used to confirm an updated product's
 * slug doesn't collide with a different product, and potentially by external
 * code that links to products by slug.
 *
 * Accepts a `DbOrTx` so it can be called inside a transaction if needed
 * (e.g. to atomically read + check uniqueness).
 */
export const findProductBySlug = async (
  slug: string,
  executor: DbOrTx = db,
) => {
  return executor.query.product.findFirst({
    where: (p) => eq(p.slug, slug),
  });
};

/**
 * Find a category by case-insensitive name match. Categories have a stricter
 * uniqueness rule than products: you cannot have two categories whose names
 * differ only in case (e.g. "Shoes" vs "shoes"). This helper exists so the
 * categories route can perform that check without re-implementing the SQL
 * expression every time.
 *
 * `executor` is optional; pass a transaction to read inside one.
 */
export const findCategoryByCaseInsensitiveName = async (
  name: string,
  executor: DbOrTx = db,
) => {
  const trimmed = name.trim();
  return executor.query.category.findFirst({
    where: (c) => sql`LOWER(${c.name}) = LOWER(${trimmed})`,
  });
};

/**
 * Find all category slugs that could collide with `baseSlug` (the base or
 * any `-N` suffix). Mirrors `generateUniqueProductSlug` for categories.
 *
 * Note: this lives in the slug helpers file (not a category-specific
 * service) because the collision-resolution algorithm is identical to the
 * product one. The caller is responsible for the *name* uniqueness check
 * separately, via `findCategoryByCaseInsensitiveName`.
 */
export const generateUniqueCategorySlug = async (
  baseSlug: string,
  excludeCategoryId?: string,
): Promise<string> => {
  const existingSlugs = await db.query.category.findMany({
    where: excludeCategoryId
      ? (c) =>
          and(
            or(eq(c.slug, baseSlug), like(c.slug, `${baseSlug}-%`)),
            ne(c.id, excludeCategoryId),
          )
      : (c) => or(eq(c.slug, baseSlug), like(c.slug, `${baseSlug}-%`)),
    columns: { slug: true },
  });

  const taken = new Set(existingSlugs.map((c) => c.slug));

  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    counter++;
  }
};

// Re-export the `category` and `product` tables so callers don't need a
// second import for simple references. This keeps the import surface in
// route/service files minimal.
export { category, product };
