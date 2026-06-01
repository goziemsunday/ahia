import { deleteImageFromR2, uploadImageToR2 } from "./r2";

export interface UploadedImage {
  url: string;
  key: string;
}

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
 * Run a function that may upload images to R2, and if it throws, delete
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
