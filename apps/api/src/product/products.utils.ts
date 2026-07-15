import { and, db, DbOrTx, eq, like, ne, or } from "@repo/db";

import { deleteImageFromR2, uploadImageToR2 } from "../lib/r2";
import { resolveSlugCollision } from "../lib/slug";
import { UploadedImage } from "./products.types";

/**
 * Find a slug derived from `baseSlug` that does not already exist on the
 * product table. If `baseSlug` is free, returns it. Otherwise appends
 * `-1`, `-2`, ... until a free one is found.
 *
 * `excludeProductId` lets update flows skip the row being updated (otherwise
 * renaming a product to its own current name would always collide).
 *
 * `executor` is optional; pass a transaction to read inside one.
 */
export const generateUniqueProductSlug = async (
  baseSlug: string,
  excludeProductId?: string,
  executor: DbOrTx = db,
): Promise<string> => {
  // Pull every slug that could collide with our base or any `-N` suffix.
  // This is one query, not N — we just need the set of taken suffixes.
  const existingSlugs = await executor.query.product.findMany({
    where: excludeProductId
      ? (p) =>
          and(
            or(eq(p.slug, baseSlug), like(p.slug, `${baseSlug}-%`)),
            ne(p.id, excludeProductId),
          )
      : (p) => or(eq(p.slug, baseSlug), like(p.slug, `${baseSlug}-%`)),
    columns: { slug: true },
  });

  return resolveSlugCollision(
    baseSlug,
    new Set(existingSlugs.map((p) => p.slug)),
  );
};

/**
 * Upload a batch of files to R2 in parallel, preserving order. If any single
 * upload rejects, the whole promise rejects (Promise.all semantics), so the
 * caller never sees a partially-uploaded batch.
 */
export const uploadProductImages = async (
  files: File[],
  folder = "products",
): Promise<UploadedImage[]> => {
  return Promise.all(files.map((file) => uploadImageToR2(file, folder)));
};

/**
 * Delete a batch of uploaded images from R2. Uses `Promise.allSettled` so
 * a single 404 or network blip doesn't abort the rest of the cleanup.
 * Individual failures are logged but never re-thrown.
 */
export const cleanupUploadedImages = async (
  images: { key: string }[],
): Promise<void> => {
  if (images.length === 0) return;
  await Promise.allSettled(
    images.map((img) =>
      deleteImageFromR2(img.key).catch((err) => {
        console.error(`Failed to delete R2 object ${img.key}:`, err);
      }),
    ),
  );
};

/**
 * Run a function that may involve images uploaded to R2, and if it throws, delete
 * every uploaded image from R2 before re-throwing the original error.
 */
export const withImageRollback = async <T>(
  uploaded: UploadedImage[],
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    await cleanupUploadedImages(uploaded);
    throw err;
  }
};
