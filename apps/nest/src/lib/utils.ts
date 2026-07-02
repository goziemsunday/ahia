/**
 * Helper function to create a success response for API routes.
 * @param data - The data to include in the response.
 * @param pagination - Optional pagination info to include in the repsonse.
 * @returns An object representing the success response.
 */
export const successResponse = <TData>(
  data: TData,
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
) => {
  return {
    data,
    ...(pagination ? { pagination } : {}),
  };
};

/**
 * Helper function to create an error response for API routes.
 * @param errorDetails - Error message.
 * @returns An object representing the error response.
 */
export const errorResponse = (errorDetails: string) => {
  return {
    error: {
      details: errorDetails,
    },
  };
};

/**
 * Build the pagination object used by `successResponse`. Returns `undefined`
 * when `limit` is not set (unpaginated requests), so callers can pass the
 * result directly to `successResponse(data, msg, pagination)`.
 */
export const buildPagination = (
  page: number | undefined,
  limit: number | undefined,
  total: number,
) => {
  if (!limit) return undefined;
  return {
    page: page ?? 1,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Generates a random password.
 * @param length - The length of the password.
 * @returns A random password.
 */
export const generatePassword = (length = 16) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(length)))
    .map((x) => chars[x % chars.length])
    .join("");
};

/**
 * Converts a value to a number, returning 0 if the value is null, undefined, or not a finite number.
 * @param value - The value to convert.
 * @returns The converted number or 0.
 */
export const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Rounds a number to 2 decimal places.
 * @param value - The number to round.
 * @returns The rounded number.
 */
export const round = (value: number) => Number(value.toFixed(2));

/**
 * Calculates the percentage change between two numbers.
 * @param current - The current value.
 * @param previous - The previous value.
 * @returns The percentage change.
 */
export const pctChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return round(((current - previous) / previous) * 100);
};
