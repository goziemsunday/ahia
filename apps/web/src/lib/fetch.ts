import {
  BetterFetchError,
  createFetch,
  type StandardSchemaV1,
} from "@better-fetch/fetch";

import { errorResSchema } from "@/lib/schemas";

import env from "./env";

const baseURL =
  typeof window === "undefined"
    ? `${env.API_URL}/api`
    : `${env.NEXT_PUBLIC_API_URL}/api`;

export const $fetch = createFetch({
  baseURL,
  credentials: "include",
  errorSchema: errorResSchema,
});

export const $fetchAndThrow = createFetch({
  baseURL,
  throw: true,
  credentials: "include",
  errorSchema: errorResSchema,
});

export async function $apiFetchAndThrow<
  T,
  O extends { output?: StandardSchemaV1 },
>(
  url: string,
  options?: O,
): Promise<
  O["output"] extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<O["output"]>
    : T
> {
  try {
    return await $fetchAndThrow(url as any, options as any) as any;
  } catch (err) {
    if (err instanceof BetterFetchError) {
      const parsed = errorResSchema.safeParse(err.error);
      const message = parsed.success
        ? parsed.data.error.details
        : err.statusText;
      throw new Error(message, { cause: err });
    }
    throw err;
  }
}
