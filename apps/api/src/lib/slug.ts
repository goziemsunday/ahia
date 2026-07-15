import slugifyLib from "slugify";

/**
 * Build the base slug from a caller-provided name. Uses the `slugify` package
 * with `lower: true` and `strict: true` to strip non-URL-safe characters.
 */
export const buildBaseSlug = (name: string): string =>
  slugifyLib(name.trim(), { lower: true, strict: true });

/**
 * Resolve slug collisions by walking `-1`, `-2`, ... until a free slug
 * is found.
 */
export const resolveSlugCollision = (
  baseSlug: string,
  taken: Set<string>,
): string => {
  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    counter++;
  }
};
