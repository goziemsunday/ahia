import {
  MAX_PRODUCT_IMAGES,
  MIN_PRODUCT_IMAGES,
  validateFile,
  validateProductImages,
} from "./file";

/**
 * Item shape for a size or color variant. Matches the `InStockSchema` in
 * lib/schemas.ts; redeclared here to avoid a circular import between
 * schemas.ts and this file.
 */
export interface InStockItem {
  name: string;
  inStock: boolean;
}

/**
 * An image stored on a product row. Matches the jsonb `$type<>` declared
 * on the `images` column in the product schema.
 */
export interface ProductImageRef {
  url: string;
  key: string;
}

/**
 * Fully-normalized input ready to be inserted/updated on a product. The
 * service layer consumes this directly; it never sees strings or missing
 * fields. All numbers are JS numbers, prices are pre-formatted to 2
 * decimal places as strings (matches the existing DB column type and the
 * numeric(10,2) display), sizes/colors/categoryIds are guaranteed arrays.
 */
export interface NormalizedCreateInput {
  name: string;
  description?: string;
  price: string;
  stockQuantity: number;
  sizes: InStockItem[];
  colors: InStockItem[];
  categoryIds: string[];
}

export interface NormalizedUpdateInput {
  name?: string;
  description?: string;
  price?: string;
  stockQuantity?: number;
  sizes?: InStockItem[];
  colors?: InStockItem[];
  categoryIds?: string[];
  keepImageKeys: string[];
}

/**
 * Discriminated union result type for all validators in this file. Keeps
 * the service layer's `if (!result.ok) ...` branches uniform.
 */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * A shape error result, used by file/image validators that only ever
 * produce field errors and no success data.
 */
export type FieldErrors = { fieldErrors: Record<string, string> };

// ── price & stockQuantity coercion ───────────────────────────────────────

/**
 * Coerce the user-supplied price string ("12", "12.5", "12.50") into a
 * 2-decimal-place string ("12.00", "12.50", "12.50") that fits the
 * numeric(10, 2) column. Returns an error message if the input isn't a
 * positive number.
 */
const normalizePrice = (raw: string | undefined): string | undefined => {
  if (raw === undefined) return undefined;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return n.toFixed(2);
};

/**
 * Coerce the user-supplied stockQuantity string ("5", "0") to a non-negative
 * integer. Returns undefined on bad input so the caller can decide whether
 * "missing" is a hard error (create) or "leave unchanged" (update).
 */
const normalizeStockQuantity = (
  raw: string | undefined,
): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
};

// ── size/Color uniqueness + stock consistency ──────────────────────────

/**
 * Verify that the variant list (sizes or colors) is internally consistent.
 *
 * Rules:
 *   1. Names must be unique case-insensitively.
 *   2. If `effectiveStock > 0`, at least one variant must have inStock=true.
 */
const validateVariants = (
  field: string,
  items: InStockItem[],
  effectiveStock: number,
  fieldErrors: Record<string, string>,
): void => {
  if (items.length === 0) return;

  const names = items.map((i) => i.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    fieldErrors[field] = `${field} names must be unique (case-insensitive)`;
    return;
  }

  if (effectiveStock > 0 && !items.some((i) => i.inStock)) {
    fieldErrors[field] =
      `At least one ${field.slice(0, -1)} must be in stock when stock quantity is greater than 0`;
  }
};

// ── create input validation ─────────────────────────────────────────────

/**
 * Shape produced by Zod for `POST /api/products`. Field names match
 * `CreateProductSchema` in lib/schemas.ts.
 */
export interface RawCreateInput {
  name: string;
  description?: string;
  price: string;
  stockQuantity: string;
  sizes: InStockItem[];
  colors: InStockItem[];
  categoryIds: string[];
  images: unknown;
}

/**
 * Validate the create-product input after Zod has parsed it. Coerces
 * price/stockQuantity to their final types and checks the cross-field
 * rules. Returns either a fully-normalized `NormalizedCreateInput` or a
 * map of field errors.
 */
export const validateCreateProductInput = (
  raw: RawCreateInput,
): ValidationResult<NormalizedCreateInput> => {
  const fieldErrors: Record<string, string> = {};

  // Price is required for create. Zod has confirmed the regex, but we
  // still re-validate to fail safely if the schema ever loosens.
  const price = normalizePrice(raw.price);
  if (price === undefined) {
    fieldErrors.price = "Price must be a positive number";
  }

  // stockQuantity is required for create (must be >= 0).
  let stockQuantity: number;
  if (raw.stockQuantity === undefined || raw.stockQuantity === "") {
    fieldErrors.stockQuantity = "Stock quantity is required";
    stockQuantity = 0;
  } else {
    const parsed = normalizeStockQuantity(raw.stockQuantity);
    if (parsed === undefined) {
      fieldErrors.stockQuantity =
        "Stock quantity must be a non-negative number";
      stockQuantity = 0;
    } else {
      stockQuantity = parsed;
    }
  }

  // Cross-field checks against the coerced values. Pass them in even on
  // error so subsequent rules still run and report all problems at once.
  validateVariants(
    "sizes",
    raw.sizes,
    price !== undefined ? stockQuantity : 0,
    fieldErrors,
  );
  validateVariants(
    "colors",
    raw.colors,
    price !== undefined ? stockQuantity : 0,
    fieldErrors,
  );

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      name: raw.name,
      description: raw.description,
      // price is a string here because the DB column is numeric(10,2)
      // and we store it pre-formatted ("12.50") for stable display.
      price: price!,
      stockQuantity,
      sizes: raw.sizes,
      colors: raw.colors,
      categoryIds: raw.categoryIds,
    },
  };
};

// ── update input validation ────────────────────────────────────────────

/**
 * Shape produced by Zod for `PUT /api/products/:id`. Every field is
 * optional except `keepImageKeys` (which the route must always send a
 * value for; see note on defaulting below).
 *
 * `existing` carries the current row state — we need it to validate that
 * `keepImageKeys` is a subset of the existing images and to compute
 * `effectiveStock` for the "at least one in stock" rule.
 */
export interface RawUpdateInput {
  name?: string;
  description?: string;
  price?: string;
  stockQuantity?: string;
  sizes?: InStockItem[];
  colors?: InStockItem[];
  categoryIds?: string[];
  keepImageKeys?: string[];
  newImages?: unknown;
}

export interface ExistingProductForUpdate {
  stockQuantity: number;
  images: ProductImageRef[];
}

export const validateUpdateProductInput = (
  raw: RawUpdateInput,
  existing: ExistingProductForUpdate,
): ValidationResult<NormalizedUpdateInput> => {
  const fieldErrors: Record<string, string> = {};

  // price is optional for update; only validate if provided.
  const price = normalizePrice(raw.price);
  if (raw.price !== undefined && price === undefined) {
    fieldErrors.price = "Price must be a positive number";
  }

  // stockQuantity is optional for update; only validate if provided.
  let stockQuantity: number | undefined;
  if (raw.stockQuantity !== undefined) {
    stockQuantity = normalizeStockQuantity(raw.stockQuantity);
    if (stockQuantity === undefined) {
      fieldErrors.stockQuantity =
        "Stock quantity must be a non-negative number";
    }
  }

  // effectiveStock is the *post-update* stock, used to evaluate the
  // "at least one in stock" rule for sizes/colors.
  const effectiveStock = stockQuantity ?? existing.stockQuantity ?? 0;

  if (raw.sizes !== undefined) {
    validateVariants("sizes", raw.sizes, effectiveStock, fieldErrors);
  }
  if (raw.colors !== undefined) {
    validateVariants("colors", raw.colors, effectiveStock, fieldErrors);
  }

  // keepImageKeys: dedupe + verify every key is present in the existing
  // product. If the client omits keepImageKeys entirely, we treat that as
  // "keep all existing images" — matching the original behavior.
  let keepImageKeys: string[];
  if (raw.keepImageKeys !== undefined) {
    keepImageKeys = Array.from(new Set(raw.keepImageKeys));
    const currentKeys = new Set(existing.images.map((img) => img.key));
    const invalid = keepImageKeys.filter((k) => !currentKeys.has(k));
    if (invalid.length > 0) {
      fieldErrors.keepImageKeys =
        invalid.length === 1
          ? `Invalid image key: '${invalid[0]}' doesn't exist in this product`
          : `Invalid image keys: '${invalid.join("', '")}' don't exist in this product`;
    }
  } else {
    keepImageKeys = existing.images.map((img) => img.key);
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      name: raw.name,
      description: raw.description,
      price,
      stockQuantity,
      sizes: raw.sizes,
      colors: raw.colors,
      categoryIds: raw.categoryIds,
      keepImageKeys,
    },
  };
};

// ── image-only validators (unchanged wire format) ─────────────────────

/**
 * Validate the create-image payload. Throws no exceptions on its own —
 * returns either `ok: true` or `ok: false` with a user-friendly error
 * message and the appropriate HTTP status code (the route forwards the
 * status unchanged). Split out from the create-input validator so the
 * service can return 422 INVALID_FILE rather than 400 INVALID_DATA for
 * image problems.
 */
export const validateCreateImagePayload = (
  images: unknown,
):
  | { ok: true }
  | { ok: false; status: number; error: string; code: string } => {
  try {
    validateProductImages(images);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_FILE",
      error: err instanceof Error ? err.message : "Image validation failed",
    };
  }
};

/**
 * Validate the new (uploaded) images for an update. Each file is
 * checked for type, size, and File-instance correctness. Errors are
 * keyed by index (`newImages.0`, `newImages.1`, ...).
 */
export const validateNewImages = (
  files: unknown[],
): { ok: true } | { ok: false; fieldErrors: Record<string, string> } => {
  const fieldErrors: Record<string, string> = {};
  files.forEach((file, index) => {
    try {
      validateFile(file, index);
    } catch (err) {
      fieldErrors[`newImages.${index}`] =
        err instanceof Error ? err.message : "Image validation failed";
    }
  });
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true };
};

/**
 * Enforce the "1-3 images total" rule on the final image set after
 * keep+new has been computed..
 */
export const validateFinalImageCount = (
  keepCount: number,
  newCount: number,
): { ok: true } | { ok: false; error: string } => {
  const total = keepCount + newCount;
  if (total < MIN_PRODUCT_IMAGES) {
    return { ok: false, error: "Product must have at least 1 image" };
  }
  if (total > MAX_PRODUCT_IMAGES) {
    return { ok: false, error: "Maximum 3 images allowed" };
  }
  return { ok: true };
};
