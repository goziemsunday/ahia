export const MAX_FILE_SIZE = 512 * 1024;
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
export const MAX_PRODUCT_IMAGES = 3;
export const MIN_PRODUCT_IMAGES = 1;

export const validateFile = (file: unknown, index: number) => {
  if (!(file instanceof File)) {
    throw new Error(`Image ${index + 1}: Invalid file format`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `Image ${index + 1}: File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    );
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error(
      `Image ${index + 1}: File type must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
    );
  }
};

export const validateProductImages = (files: unknown) => {
  if (!Array.isArray(files)) {
    throw new Error("Images must be an array");
  }

  if (files.length < MIN_PRODUCT_IMAGES) {
    throw new Error(`At least ${MIN_PRODUCT_IMAGES} image is required`);
  }

  if (files.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Maximum ${MAX_PRODUCT_IMAGES} images allowed`);
  }

  files.forEach(validateFile);
};
