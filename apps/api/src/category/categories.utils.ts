import { and, db, DbOrTx, eq, like, ne, or, sql } from "@repo/db";

import { resolveSlugCollision } from "../lib/slug";

/**
 * Find a category by case-insensitive name match. You cannot have two categories
 * whose names differ only in case.
 *
 * `excludeCategoryId` lets update flows skip the row being updated (otherwise
 * renaming a category to its own current name would always collide).
 *
 * `executor` is optional; pass a transaction to read inside one.
 */
export const findCategoryByCaseInsensitiveName = async (
  name: string,
  excludeCategoryId?: string,
  executor: DbOrTx = db,
) => {
  const trimmed = name.trim();
  return executor.query.category.findFirst({
    where: excludeCategoryId
      ? (c) =>
          and(
            sql`LOWER(${c.name}) = LOWER(${trimmed})`,
            ne(c.id, excludeCategoryId),
          )
      : (c) => sql`LOWER(${c.name}) = LOWER(${trimmed})`,
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
 *
 * `executor` is optional; pass a transaction to read inside one.
 */
export const generateUniqueCategorySlug = async (
  baseSlug: string,
  excludeCategoryId?: string,
  executor: DbOrTx = db,
): Promise<string> => {
  const existingSlugs = await executor.query.category.findMany({
    where: excludeCategoryId
      ? (c) =>
          and(
            or(eq(c.slug, baseSlug), like(c.slug, `${baseSlug}-%`)),
            ne(c.id, excludeCategoryId),
          )
      : (c) => or(eq(c.slug, baseSlug), like(c.slug, `${baseSlug}-%`)),
    columns: { slug: true },
  });

  return resolveSlugCollision(
    baseSlug,
    new Set(existingSlugs.map((c) => c.slug)),
  );
};
