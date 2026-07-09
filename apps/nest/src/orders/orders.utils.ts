/**
 * Generate a random order number
 */
export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString().slice(2, 8).padStart(6, "0");
  return `ORD-${year}-${randomSuffix}`;
};
